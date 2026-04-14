export interface TenderSummary {
  expediente: string
  slug: string
  description: string
  contract_type: string
  contract_subtype?: string
  status: string
  budget?: number
  submission_deadline?: string
  contracting_authority: string
  // Presence indicates detail has been fetched:
  procedure_type?: string
  // Presence indicates analysis has been done:
  analysis?: AnalysisResult
}

export interface Tender extends TenderSummary {
  estimated_value?: number
  processing_type?: string
  execution_location?: string
  contracting_system?: string
  submission_method?: string
  eu_financing?: string
  authority_classification?: string
  last_updated?: string
  external_link?: string
  cpv_codes?: string[]
  awardee?: string
  award_amount?: number
  award_date?: string
  num_bidders?: string
  publications?: Publication[]
  documents?: TenderDocument[]
  sealedDocuments?: SealedDocument[]
}

export interface Publication {
  date: string
  type: string
  medium: string
}

export interface TenderDocument {
  title: string
  links: { url: string; format: string; r2?: { key: string; publicUrl?: string } }[]
}

export interface SealedDocument {
  title: string
  url: string
  r2?: { key: string; publicUrl?: string }
}

export interface TenderList {
  items: TenderSummary[]
  total: number
  page: number
  pages: number
  limit: number
}

// Analysis types
export interface AnalysisResult {
  bid_ref: string
  analysis_date: string
  document_inventory: {
    primary_document: string
    supplementary_documents: string[]
    missing_referenced: { name: string; relevance: 'HIGH' | 'MEDIUM' | 'LOW' }[]
  }
  legal_framework: {
    framework: string | null
    articles_cited: string[]
    notes: string | null
  }
  envelope_a_documents: {
    required: boolean
    documents: { name: string; details: string }[]
  }
  envelope_b_technical_proposal: {
    required: boolean
    document_name: string | null
    max_pages: number | null
    sections_required: string[]
    scoring_criteria: string | null
    estimated_effort_days: number | null
    high_effort_flag: boolean
  }
  envelope_b_additional: {
    documents: { name: string; details: string }[]
  }
  envelope_c_pricing: {
    template_provided: boolean
    template_name: string | null
    requires_hour_breakdown: boolean
    breakdown_by_seniority: boolean
    fixed_price_only: boolean
    unit_prices_required: boolean
    price_cap_eur: number | null
  }
  proof_of_concept: {
    required: boolean
    type: 'pre-award' | 'post-award' | null
    description: string | null
  }
  public_budget_rates: {
    rates_disclosed: boolean
    rates: { role: string; hourly_rate_eur: number; estimated_hours: number | null }[]
    total_public_budget_eur_excl_vat: number | null
    total_public_budget_eur_incl_vat: number | null
  }
  physical_presence: {
    required: boolean
    mandatory_days_per_week: number | null
    mandatory_days_per_month: number | null
    location: string | null
    travel_costs_covered_by_client: boolean | null
    remote_work_allowed: boolean | null
    notes: string | null
  }
  partner_certifications: {
    required: boolean
    certifications: { vendor: string; level: string; equivalent_allowed: boolean; scope: 'company' | 'individual' }[]
  }
  required_certifications: {
    required: boolean
    certifications: { name: string; issuing_body: string | null; mandatory: boolean; scope: 'company' | 'individual' | 'system'; notes: string | null }[]
  }
  proprietary_licenses: {
    required: boolean
    licenses: { name: string; provided_by_client: boolean; pre_bid_required: boolean; estimated_cost_eur: number | null }[]
  }
  minimum_turnover: {
    required: boolean
    amount_eur: number | null
    years_required: number | null
    proof_document: string | null
    is_elimination_criterion: boolean
    high_threshold_flag: boolean
  }
  technology_stack: {
    technologies_specified: boolean
    technologies: { name: string; version: string | null; is_legacy: boolean }[]
    modern_equivalents_allowed: boolean | null
    legacy_flag: boolean
  }
  hosting_requirements: {
    restrictions: boolean
    jurisdiction: string | null
    on_premise_required: boolean
    government_cloud_required: boolean
    allowed_providers: string[]
    conflicts_with_standard_cloud: boolean
  }
  legacy_integration: {
    required: boolean
    systems: { name: string; documentation_available: boolean | null }[]
    risk_flag: 'HIGH' | 'MEDIUM' | 'LOW' | null
  }
  project_complexity: {
    type: 'standard-crud' | 'data-science' | 'ai-ml' | 'mixed' | 'other'
    specialised_hires_needed: boolean
    description: string | null
  }
  fte_requirements: {
    required: boolean
    profiles: { role: string; fte: number; dedication_pct: number | null }[]
    team_capacity_flag: boolean
  }
  sla_requirements: {
    required: boolean
    support_hours: string | null
    response_times: { critical: string | null; high: string | null; medium: string | null; low: string | null }
    resolution_times: { critical: string | null; high: string | null; medium: string | null; low: string | null }
    penalties: string | null
    exceeds_standard_flag: boolean
  }
  contract_structure: {
    type: 'one-off' | 'framework' | 'mixed'
    initial_duration_months: number | null
    extensions_possible: boolean
    max_extension_years: number | null
    max_total_value_eur: number | null
    recurring_revenue: boolean
    early_termination_clause: boolean | null
  }
  intellectual_property: {
    full_transfer_required: boolean
    vendor_reuse_allowed: boolean
    restrictions: string | null
    ip_flag: boolean
  }
  summary: {
    contract_value_eur: number | null
    contract_value_range: 'below-50k' | '50k-400k' | '400k-700k' | 'above-700k' | null
    hard_flags: string[]
    soft_flags: string[]
    risk_score: number
    recommendation: 'GREEN' | 'AMBER' | 'RED'
    recommendation_reason: string
  }
}
