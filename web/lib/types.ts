export type VerificationTier =
  | "unverified"
  | "auto_verified"
  | "community"
  | "official";

export interface TaskRow {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  area: string | null;
  paper_count: number;
  result_count: number;
}

export interface AreaSummary {
  area: string;
  task_count: number;
  paper_count: number;
  result_count: number;
  top_tasks: string[]; // top 3 task names by result_count
}

export interface LeaderboardRow {
  id: number;
  model_name: string;
  dataset_name: string;
  best_metric_name: string | null;
  best_metric_value: number | null;
  paper_id: string | null;
  paper_title: string | null;
  evaluated_on: string | null;
  uses_extra_data: boolean;
  verification: VerificationTier;
}

export interface PaperDetail {
  id: string;
  arxiv_id: string | null;
  title: string;
  abstract: string | null;
  url_abs: string | null;
  url_pdf: string | null;
  published: string | null;
  authors: string[];
  proceeding: string | null;
  tasks: string[];
  methods: string[];
  verification: VerificationTier;
}

export interface CodeLink {
  repo_url: string;
  framework: string | null;
  is_official: boolean;
  mentioned_in_paper: boolean;
}
