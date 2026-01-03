export type ProfileRow = {
  user_id: string;
  full_name: string | null;
  agency_id: string | null;
  role: string | null;
  created_at: string;
  avatar_url: string | null;
};

export type AgencyRow = {
  id: string;
  name: string | null;
  owner_id: string | null;
  created_at: string;
};

export type MembershipRow = {
  agency_id: string;
  user_id: string;
  role: string | null;
  status: string | null;
  created_at: string;
};

export type MembershipViewRow = MembershipRow & {
  users_profile?: { user_id: string; full_name: string | null; avatar_url: string | null } | null;
  agencies?: AgencyRow | null;
};
