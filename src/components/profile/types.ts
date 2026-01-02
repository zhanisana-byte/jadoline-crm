export type GlobalRole = "OWNER" | "CM" | "FITNESS";
export type AgencyRole = "OWNER" | "CM" | "MEMBER";

export type ProfileRow = {
  user_id: string;
  full_name: string | null;
  role: GlobalRole;
  created_at: string;
  avatar_url?: string | null;
};

export type AgencyRow = {
  id: string;
  name: string | null;
};

export type MembershipRow = {
  id: string;
  agency_id: string;
  user_id: string;
  role: AgencyRole;
  status: string | null;
  agencies?: AgencyRow | AgencyRow[] | null;
};

export type MemberViewRow = {
  user_id: string;
  role: AgencyRole;
  status: string | null;
  users_profile?: {
    full_name: string | null;
    avatar_url?: string | null;
  } | null;
};

export type AgencyKeyRow = {
  id: string;
  active: boolean;
  created_at: string;
};
