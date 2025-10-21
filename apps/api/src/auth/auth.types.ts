export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  site?: {
    id: string;
    code: string;
    name: string;
  } | null;
  siteId?: string | null;
}
