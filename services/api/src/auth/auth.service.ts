import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, scrypt as scryptCb } from 'node:crypto';
import { promisify } from 'node:util';
import { DbService } from '../db/db.service';

const scrypt = promisify(scryptCb);

type Role = 'WORKER'|'EMPLOYER'|'AGENCY';

@Injectable()
export class AuthService {
  constructor(private readonly db: DbService) {}

  private hashToken(token: string) { return createHash('sha256').update(token).digest('hex'); }

  private async hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
    const derived = await scrypt(password, salt, 64) as Buffer;
    return { salt, hash: derived.toString('hex') };
  }

  private async verifyPassword(password: string, salt: string, expected: string) {
    const { hash } = await this.hashPassword(password, salt);
    return hash === expected;
  }

  async register(input: { displayName: string; email: string; password: string; role: Role }) {
    const email = input.email.trim().toLowerCase();
    if (!email || !input.password || input.password.length < 8 || !input.displayName.trim()) {
      throw new BadRequestException('Name, email and a password of at least 8 characters are required.');
    }
    if (!['WORKER','EMPLOYER','AGENCY'].includes(input.role)) throw new BadRequestException('Invalid role.');
    const existing = await this.db.query<{id:string}>('SELECT id FROM accounts WHERE email=$1', [email]);
    if (existing.rowCount) throw new BadRequestException('An account with this email already exists.');
    const password = await this.hashPassword(input.password);
    const result = await this.db.transaction(async client => {
      const user = await client.query<{id:string;public_id:string;display_name:string}>(
        `INSERT INTO users(public_id,display_name) VALUES($1,$2) RETURNING id,public_id,display_name`,
        [`WP-${randomBytes(5).toString('hex').toUpperCase()}`, input.displayName.trim()]
      );
      await client.query(
        `INSERT INTO accounts(user_id,email,password_hash,password_salt,role) VALUES($1,$2,$3,$4,$5)`,
        [user.rows[0].id,email,password.hash,password.salt,input.role]
      );
      if (input.role === 'WORKER') await client.query(`INSERT INTO worker_profiles(user_id) VALUES($1)`, [user.rows[0].id]);
      return user.rows[0];
    });
    return this.createSession(result.id, email, input.role, result.display_name, result.public_id);
  }

  async login(emailInput: string, password: string) {
    const email = emailInput.trim().toLowerCase();
    const result = await this.db.query<any>(
      `SELECT a.user_id,a.email,a.password_hash,a.password_salt,a.role,u.display_name,u.public_id
       FROM accounts a JOIN users u ON u.id=a.user_id WHERE a.email=$1`, [email]
    );
    const account = result.rows[0];
    if (!account || !account.password_salt || !(await this.verifyPassword(password, account.password_salt, account.password_hash))) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    await this.db.query('UPDATE accounts SET last_login_at=now(),updated_at=now() WHERE user_id=$1', [account.user_id]);
    return this.createSession(account.user_id, account.email, account.role, account.display_name, account.public_id);
  }

  private async createSession(userId:string,email:string,role:Role,displayName:string,publicId:string) {
    const token = randomBytes(32).toString('hex');
    await this.db.query(`DELETE FROM auth_sessions WHERE user_id=$1 OR expires_at < now()`, [userId]);
    await this.db.query(`INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '30 days')`, [this.hashToken(token), userId]);
    return { token, user: { id:userId, publicId, displayName, email, role } };
  }

  async me(token?: string) {
    if (!token) throw new UnauthorizedException('Authentication required.');
    const result = await this.db.query<any>(
      `SELECT u.id,u.public_id,u.display_name,a.email,a.role FROM auth_sessions s
       JOIN users u ON u.id=s.user_id JOIN accounts a ON a.user_id=u.id
       WHERE s.token_hash=$1 AND s.expires_at>now()`, [this.hashToken(token)]
    );
    if (!result.rowCount) throw new UnauthorizedException('Session expired.');
    return { user: { id:result.rows[0].id, publicId:result.rows[0].public_id, displayName:result.rows[0].display_name, email:result.rows[0].email, role:result.rows[0].role } };
  }

  async logout(token?: string) {
    if (token) await this.db.query('DELETE FROM auth_sessions WHERE token_hash=$1', [this.hashToken(token)]);
    return { ok:true };
  }
}
