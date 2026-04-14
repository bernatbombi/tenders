import type { AnalysisResult } from '@/lib/types'
import { formatCurrency } from '@/lib/format'

interface Props {
  analysis: AnalysisResult
}

const recColors = {
  GREEN: { banner: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-800', bar: 'bg-green-500' },
  AMBER: { banner: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-800', bar: 'bg-amber-500' },
  RED: { banner: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-800', bar: 'bg-red-500' },
}

const riskColors = {
  HIGH: 'bg-red-100 text-red-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW: 'bg-green-100 text-green-700',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900 mt-0.5">{String(value)}</dd>
    </div>
  )
}

function Bool({ value }: { value: boolean | null | undefined }) {
  if (value == null) return <span className="text-slate-400 text-sm">—</span>
  return <span className={`text-sm font-medium ${value ? 'text-green-700' : 'text-slate-500'}`}>{value ? 'Yes' : 'No'}</span>
}

function Tag({ label, variant = 'neutral' }: { label: string; variant?: 'red' | 'amber' | 'green' | 'neutral' }) {
  const cls = {
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-700',
    green: 'bg-green-100 text-green-700',
    neutral: 'bg-slate-100 text-slate-600',
  }[variant]
  return <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
}

export default function AnalysisView({ analysis }: Props) {
  const { summary } = analysis
  const rec = summary.recommendation
  const colors = recColors[rec]

  return (
    <div className="space-y-4">
      {/* Summary hero */}
      <div className={`rounded-lg border-2 p-6 ${colors.banner}`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span className={`inline-block text-sm font-bold px-3 py-1 rounded-full mb-3 ${colors.badge}`}>
              {rec}
            </span>
            <p className="text-slate-800 text-sm max-w-2xl">{summary.recommendation_reason}</p>
          </div>
          <div className="text-right shrink-0">
            {summary.contract_value_eur != null && (
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(summary.contract_value_eur)}</p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              Risk score: <span className="font-semibold text-slate-700">{summary.risk_score}/100</span>
            </p>
            <div className="w-32 h-1.5 bg-slate-200 rounded-full mt-1.5 ml-auto">
              <div className={`h-1.5 rounded-full ${colors.bar}`} style={{ width: `${summary.risk_score}%` }} />
            </div>
          </div>
        </div>

        {(summary.hard_flags.length > 0 || summary.soft_flags.length > 0) && (
          <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
            {summary.hard_flags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs text-slate-500 self-center">Hard flags:</span>
                {summary.hard_flags.map(f => <Tag key={f} label={f} variant="red" />)}
              </div>
            )}
            {summary.soft_flags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs text-slate-500 self-center">Soft flags:</span>
                {summary.soft_flags.map(f => <Tag key={f} label={f} variant="amber" />)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail sections grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Document Inventory */}
        <Section title="Document Inventory">
          <div className="space-y-2">
            <Field label="Primary document" value={analysis.document_inventory.primary_document} />
            {analysis.document_inventory.supplementary_documents.length > 0 && (
              <div>
                <dt className="text-xs text-slate-500 mb-1">Supplementary</dt>
                <ul className="space-y-0.5">
                  {analysis.document_inventory.supplementary_documents.map((d, i) => (
                    <li key={i} className="text-sm text-slate-700">— {d}</li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.document_inventory.missing_referenced.length > 0 && (
              <div>
                <dt className="text-xs text-slate-500 mb-1">Missing / referenced but not provided</dt>
                <ul className="space-y-1">
                  {analysis.document_inventory.missing_referenced.map((m, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Tag label={m.relevance} variant={m.relevance === 'HIGH' ? 'red' : m.relevance === 'MEDIUM' ? 'amber' : 'neutral'} />
                      <span className="text-sm text-slate-700">{m.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Section>

        {/* Contract Structure */}
        <Section title="Contract Structure">
          <dl className="grid grid-cols-2 gap-3">
            <Field label="Type" value={analysis.contract_structure.type} />
            <Field label="Duration" value={analysis.contract_structure.initial_duration_months != null ? `${analysis.contract_structure.initial_duration_months} months` : null} />
            <div>
              <dt className="text-xs text-slate-500">Extensions</dt>
              <dd><Bool value={analysis.contract_structure.extensions_possible} /></dd>
            </div>
            <Field label="Max extension" value={analysis.contract_structure.max_extension_years != null ? `${analysis.contract_structure.max_extension_years} years` : null} />
            <Field label="Max value" value={analysis.contract_structure.max_total_value_eur != null ? formatCurrency(analysis.contract_structure.max_total_value_eur) : null} />
            <div>
              <dt className="text-xs text-slate-500">Recurring revenue</dt>
              <dd><Bool value={analysis.contract_structure.recurring_revenue} /></dd>
            </div>
          </dl>
        </Section>

        {/* Budget & Rates */}
        <Section title="Budget & Rates">
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-slate-500">Rates disclosed</dt>
              <dd><Bool value={analysis.public_budget_rates.rates_disclosed} /></dd>
            </div>
            {analysis.public_budget_rates.rates.length > 0 && (
              <div>
                <dt className="text-xs text-slate-500 mb-2">Rate breakdown</dt>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400">
                      <th className="text-left font-normal pb-1">Role</th>
                      <th className="text-right font-normal pb-1">€/h</th>
                      <th className="text-right font-normal pb-1">Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analysis.public_budget_rates.rates.map((r, i) => (
                      <tr key={i}>
                        <td className="py-1 text-slate-700">{r.role}</td>
                        <td className="py-1 text-right text-slate-900 font-medium">{r.hourly_rate_eur}</td>
                        <td className="py-1 text-right text-slate-600">{r.estimated_hours ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Field label="Total (excl. VAT)" value={formatCurrency(analysis.public_budget_rates.total_public_budget_eur_excl_vat)} />
            <Field label="Total (incl. VAT)" value={formatCurrency(analysis.public_budget_rates.total_public_budget_eur_incl_vat)} />
          </dl>
        </Section>

        {/* Envelopes */}
        <Section title="Submission Envelopes">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-slate-600 mb-1.5">
                Envelope A — Solvency {analysis.envelope_a_documents.required ? '' : <span className="text-slate-400">(not required)</span>}
              </p>
              {analysis.envelope_a_documents.documents.length > 0 && (
                <ul className="space-y-1">
                  {analysis.envelope_a_documents.documents.map((d, i) => (
                    <li key={i} className="text-sm text-slate-700">
                      <span className="font-medium">{d.name}</span>
                      {d.details && <p className="text-xs text-slate-500 mt-0.5">{d.details}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-slate-600 mb-1.5">
                Envelope B — Technical Proposal {!analysis.envelope_b_technical_proposal.required && <span className="text-slate-400">(not required)</span>}
              </p>
              {analysis.envelope_b_technical_proposal.required && (
                <dl className="grid grid-cols-2 gap-2">
                  <Field label="Document name" value={analysis.envelope_b_technical_proposal.document_name} />
                  <Field label="Max pages" value={analysis.envelope_b_technical_proposal.max_pages} />
                  <Field label="Est. effort" value={analysis.envelope_b_technical_proposal.estimated_effort_days != null ? `${analysis.envelope_b_technical_proposal.estimated_effort_days} days` : null} />
                  <div>
                    <dt className="text-xs text-slate-500">High effort</dt>
                    <dd><Bool value={analysis.envelope_b_technical_proposal.high_effort_flag} /></dd>
                  </div>
                </dl>
              )}
              {analysis.envelope_b_technical_proposal.sections_required.length > 0 && (
                <div className="mt-2">
                  <dt className="text-xs text-slate-500 mb-1">Sections required</dt>
                  <ul className="space-y-0.5">
                    {analysis.envelope_b_technical_proposal.sections_required.map((s, i) => (
                      <li key={i} className="text-sm text-slate-700">— {s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-slate-600 mb-1.5">Envelope C — Pricing</p>
              <dl className="grid grid-cols-2 gap-2">
                <div>
                  <dt className="text-xs text-slate-500">Template provided</dt>
                  <dd><Bool value={analysis.envelope_c_pricing.template_provided} /></dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Hour breakdown</dt>
                  <dd><Bool value={analysis.envelope_c_pricing.requires_hour_breakdown} /></dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Fixed price only</dt>
                  <dd><Bool value={analysis.envelope_c_pricing.fixed_price_only} /></dd>
                </div>
                <Field label="Price cap" value={formatCurrency(analysis.envelope_c_pricing.price_cap_eur)} />
              </dl>
            </div>
          </div>
        </Section>

        {/* Physical Presence */}
        <Section title="Physical Presence">
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-slate-500">Required</dt>
              <dd><Bool value={analysis.physical_presence.required} /></dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Remote allowed</dt>
              <dd><Bool value={analysis.physical_presence.remote_work_allowed} /></dd>
            </div>
            <Field label="Days/week" value={analysis.physical_presence.mandatory_days_per_week} />
            <Field label="Days/month" value={analysis.physical_presence.mandatory_days_per_month} />
            <Field label="Location" value={analysis.physical_presence.location} />
            <div>
              <dt className="text-xs text-slate-500">Travel covered</dt>
              <dd><Bool value={analysis.physical_presence.travel_costs_covered_by_client} /></dd>
            </div>
          </dl>
          {analysis.physical_presence.notes && (
            <p className="mt-3 text-xs text-slate-500 border-t border-slate-100 pt-3">{analysis.physical_presence.notes}</p>
          )}
        </Section>

        {/* Technology */}
        <Section title="Technology">
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-slate-500">Technologies specified</dt>
              <dd><Bool value={analysis.technology_stack.technologies_specified} /></dd>
            </div>
            {analysis.technology_stack.technologies.length > 0 && (
              <div>
                <dt className="text-xs text-slate-500 mb-1">Stack</dt>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.technology_stack.technologies.map((t, i) => (
                    <span key={i} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${t.is_legacy ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                      {t.name}{t.version ? ` ${t.version}` : ''}
                      {t.is_legacy && ' ⚠'}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div>
              <dt className="text-xs text-slate-500">Legacy flag</dt>
              <dd><Bool value={analysis.technology_stack.legacy_flag} /></dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Modern equivalents allowed</dt>
              <dd><Bool value={analysis.technology_stack.modern_equivalents_allowed} /></dd>
            </div>
          </dl>
        </Section>

        {/* Team (FTE) */}
        <Section title="Team Requirements">
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-slate-500">FTE required</dt>
              <dd><Bool value={analysis.fte_requirements.required} /></dd>
            </div>
            {analysis.fte_requirements.profiles.length > 0 && (
              <div>
                <dt className="text-xs text-slate-500 mb-2">Profiles</dt>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400">
                      <th className="text-left font-normal pb-1">Role</th>
                      <th className="text-right font-normal pb-1">FTE</th>
                      <th className="text-right font-normal pb-1">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analysis.fte_requirements.profiles.map((p, i) => (
                      <tr key={i}>
                        <td className="py-1 text-slate-700">{p.role}</td>
                        <td className="py-1 text-right font-medium text-slate-900">{p.fte}</td>
                        <td className="py-1 text-right text-slate-600">{p.dedication_pct ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div>
              <dt className="text-xs text-slate-500">Capacity flag</dt>
              <dd><Bool value={analysis.fte_requirements.team_capacity_flag} /></dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Specialised hires</dt>
              <dd><Bool value={analysis.project_complexity.specialised_hires_needed} /></dd>
            </div>
          </dl>
        </Section>

        {/* SLA */}
        <Section title="SLA Requirements">
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-slate-500">Required</dt>
              <dd><Bool value={analysis.sla_requirements.required} /></dd>
            </div>
            {analysis.sla_requirements.required && (
              <>
                <Field label="Support hours" value={analysis.sla_requirements.support_hours} />
                {(Object.values(analysis.sla_requirements.response_times).some(Boolean)) && (
                  <div>
                    <dt className="text-xs text-slate-500 mb-1">Response times</dt>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-400">
                          <th className="text-left font-normal pb-1">Priority</th>
                          <th className="text-right font-normal pb-1">Response</th>
                          <th className="text-right font-normal pb-1">Resolution</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(['critical', 'high', 'medium', 'low'] as const).map(p => (
                          <tr key={p}>
                            <td className="py-1 text-slate-700 capitalize">{p}</td>
                            <td className="py-1 text-right text-slate-900">{analysis.sla_requirements.response_times[p] ?? '—'}</td>
                            <td className="py-1 text-right text-slate-600">{analysis.sla_requirements.resolution_times[p] ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-slate-500">Exceeds standard</dt>
                  <dd><Bool value={analysis.sla_requirements.exceeds_standard_flag} /></dd>
                </div>
                {analysis.sla_requirements.penalties && (
                  <Field label="Penalties" value={analysis.sla_requirements.penalties} />
                )}
              </>
            )}
          </dl>
        </Section>

        {/* Certifications */}
        {(analysis.required_certifications.required || analysis.partner_certifications.required) && (
          <Section title="Certifications">
            <div className="space-y-4">
              {analysis.required_certifications.certifications.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">Required certifications</p>
                  <ul className="space-y-2">
                    {analysis.required_certifications.certifications.map((c, i) => (
                      <li key={i} className="text-sm">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-slate-800">{c.name}</span>
                          <Tag label={c.scope} variant="neutral" />
                          {c.mandatory && <Tag label="Mandatory" variant="red" />}
                        </div>
                        {c.issuing_body && <p className="text-xs text-slate-500 mt-0.5">{c.issuing_body}</p>}
                        {c.notes && <p className="text-xs text-slate-400 mt-0.5">{c.notes}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {analysis.partner_certifications.certifications.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">Partner certifications</p>
                  <ul className="space-y-1">
                    {analysis.partner_certifications.certifications.map((c, i) => (
                      <li key={i} className="text-sm flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-800">{c.vendor}</span>
                        <span className="text-slate-500">{c.level}</span>
                        <Tag label={c.scope} variant="neutral" />
                        {!c.equivalent_allowed && <Tag label="No equivalents" variant="amber" />}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Minimum turnover */}
        {analysis.minimum_turnover.required && (
          <Section title="Minimum Turnover">
            <dl className="grid grid-cols-2 gap-3">
              <Field label="Amount" value={formatCurrency(analysis.minimum_turnover.amount_eur)} />
              <Field label="Years required" value={analysis.minimum_turnover.years_required} />
              <div>
                <dt className="text-xs text-slate-500">Elimination criterion</dt>
                <dd><Bool value={analysis.minimum_turnover.is_elimination_criterion} /></dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">High threshold</dt>
                <dd><Bool value={analysis.minimum_turnover.high_threshold_flag} /></dd>
              </div>
              <Field label="Proof document" value={analysis.minimum_turnover.proof_document} />
            </dl>
          </Section>
        )}

        {/* Hosting */}
        {analysis.hosting_requirements.restrictions && (
          <Section title="Hosting Requirements">
            <dl className="grid grid-cols-2 gap-3">
              <Field label="Jurisdiction" value={analysis.hosting_requirements.jurisdiction} />
              <div>
                <dt className="text-xs text-slate-500">On-premise required</dt>
                <dd><Bool value={analysis.hosting_requirements.on_premise_required} /></dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Gov cloud required</dt>
                <dd><Bool value={analysis.hosting_requirements.government_cloud_required} /></dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Conflicts with cloud</dt>
                <dd><Bool value={analysis.hosting_requirements.conflicts_with_standard_cloud} /></dd>
              </div>
              {analysis.hosting_requirements.allowed_providers.length > 0 && (
                <div className="col-span-2">
                  <dt className="text-xs text-slate-500 mb-1">Allowed providers</dt>
                  <div className="flex gap-1.5 flex-wrap">
                    {analysis.hosting_requirements.allowed_providers.map((p, i) => (
                      <Tag key={i} label={p} variant="neutral" />
                    ))}
                  </div>
                </div>
              )}
            </dl>
          </Section>
        )}

        {/* Legacy integration */}
        {analysis.legacy_integration.required && (
          <Section title="Legacy Integration">
            <dl className="space-y-3">
              {analysis.legacy_integration.risk_flag && (
                <div>
                  <dt className="text-xs text-slate-500">Risk</dt>
                  <dd>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${riskColors[analysis.legacy_integration.risk_flag]}`}>
                      {analysis.legacy_integration.risk_flag}
                    </span>
                  </dd>
                </div>
              )}
              {analysis.legacy_integration.systems.length > 0 && (
                <div>
                  <dt className="text-xs text-slate-500 mb-1">Systems</dt>
                  <ul className="space-y-0.5">
                    {analysis.legacy_integration.systems.map((s, i) => (
                      <li key={i} className="text-sm text-slate-700 flex items-center gap-2">
                        {s.name}
                        {s.documentation_available != null && (
                          <span className={`text-xs ${s.documentation_available ? 'text-green-600' : 'text-red-500'}`}>
                            {s.documentation_available ? '(docs available)' : '(no docs)'}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </dl>
          </Section>
        )}

        {/* IP */}
        <Section title="Intellectual Property">
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-slate-500">Full transfer required</dt>
              <dd><Bool value={analysis.intellectual_property.full_transfer_required} /></dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Vendor reuse allowed</dt>
              <dd><Bool value={analysis.intellectual_property.vendor_reuse_allowed} /></dd>
            </div>
            {analysis.intellectual_property.restrictions && (
              <div className="col-span-2">
                <Field label="Restrictions" value={analysis.intellectual_property.restrictions} />
              </div>
            )}
          </dl>
        </Section>

        {/* Legal framework */}
        {analysis.legal_framework.framework && (
          <Section title="Legal Framework">
            <dl className="space-y-3">
              <Field label="Framework" value={analysis.legal_framework.framework} />
              {analysis.legal_framework.articles_cited.length > 0 && (
                <div>
                  <dt className="text-xs text-slate-500 mb-1">Articles cited</dt>
                  <div className="flex gap-1 flex-wrap">
                    {analysis.legal_framework.articles_cited.map((a, i) => (
                      <Tag key={i} label={a} variant="neutral" />
                    ))}
                  </div>
                </div>
              )}
              {analysis.legal_framework.notes && (
                <Field label="Notes" value={analysis.legal_framework.notes} />
              )}
            </dl>
          </Section>
        )}
      </div>
    </div>
  )
}
