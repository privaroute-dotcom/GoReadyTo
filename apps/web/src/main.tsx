/// <reference types="vite/client" />

import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,useLocation,useNavigate} from 'react-router-dom';
import {APIProvider,Map,AdvancedMarker,InfoWindow,useMap} from '@vis.gl/react-google-maps';
import {Search,Map as MapIcon,BriefcaseBusiness,Users,Building2,MessageSquare,Settings,Plus,LogIn,ChevronRight,ShieldCheck,Video,FileText,ClipboardCheck,Globe2,Menu,X,Send,UserRound,LocateFixed,LogOut,LockKeyhole,Mail,UserPlus,CheckCircle2,LayoutDashboard,UserCog,UserCheck,Building,BadgeCheck,ClipboardList,CalendarDays,Scale,AlertTriangle,ExternalLink} from 'lucide-react';
import './styles.css';

type Role='WORKER'|'EMPLOYER'|'AGENCY';
type User={id:string;publicId:string;displayName:string;email:string;role:Role};
type Kind='job'|'worker'|'company';
type Item={id:string;kind:Kind;name:string;title:string;city:string;country:string;lat:number;lng:number;meta:string;verified?:boolean;salary?:string};

