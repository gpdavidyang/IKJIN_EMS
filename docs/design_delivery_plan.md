# IKJIN EMS – Design Delivery & Collaboration Plan

## 1. Deliverables Overview
| Phase | Deliverable | Owner | Due | Notes |
| --- | --- | --- | --- | --- |
| Sprint 1 | Low-fi wireframes (existing) → refine | UX Designer | Week 1 | Use `docs/ui_wireframes.md`, `docs/ui_mockups_lowfi.md` as baseline. |
| Sprint 2 | Figma high-fidelity dashboards, forms | UX Designer | Week 3 | Apply `docs/design_system_guidelines.md` tokens. Desktop + tablet. |
| Sprint 2 | Component library in Figma (buttons, tables, modals) | UX + Frontend | Week 4 | Align naming with `packages/ui`. |
| Sprint 3 | Interaction prototypes (approval flow animations) | UX Designer | Week 6 | Use Figma interactive components. |
| Sprint 3 | Accessibility review report | UX + QA | Week 6 | Stark/Contrast plugin snapshots. |
| Sprint 4 | Design handoff package | UX | Week 8 | Redlines, spacing, responsive specs, exportable assets. |

## 2. Figma Project Structure
```
IKJIN EMS
├── 00_Foundations
│   ├── Color Tokens
│   ├── Typography
│   ├── Grid & Layout
│   └── Icon Library
├── 01_Components
│   ├── Buttons
│   ├── Form Controls
│   ├── Tables
│   ├── Modals & Toasts
│   └── Charts
├── 02_Pages
│   ├── Submitter Dashboard
│   ├── Expense Form
│   ├── Approval Queue
│   ├── HQ Dashboard
│   └── User Management
└── 03_Prototypes
    ├── Approval Flow
    ├── Rejection with Comment
    └── Report Export
```

## 3. Collaboration Workflow
1. **Design Kickoff**: Review `docs/design_principles.md` and confirm brand palette.
2. **Weekly Sync**: UX + Frontend + PM (30분) – Figma progress, blockers.
3. **Feedback Cycles**:
   - Async comments in Figma.
   - Summaries logged in Jira tickets.
   - Max 2 rounds per deliverable to maintain schedule.
4. **Design Tokens Export**:
   - Use Figma Tokens plugin to sync `tokens.json` with `packages/ui`.
   - Version bump per sprint.
5. **Handoff Checklist**:
   - Auto-layout usage, naming conventions.
   - Variant documentation (button states, table rows).
   - Accessibility annotations (focus order, screen reader labels).

## 4. Review & Approval Steps
- **Stage Gate 1 (Week 2)**: UX → PM sign-off on foundations and key layouts.
- **Stage Gate 2 (Week 4)**: Engineering review for component feasibility.
- **Stage Gate 3 (Week 6)**: Compliance check (accessibility, localization).
- **Stage Gate 4 (Week 8)**: Final stakeholder review before build freeze.

## 5. Tools & Integrations
- Figma + FigJam for ideation.
- Zeplin export optional for stakeholders preferring specs view.
- Storybook Docs to mirror implemented components.
- Slack channel `#ikjin-ems-design` for quick discussions.
- Notion page aggregating links to docs, Figma, Storybook.

## 6. Risk Mitigation
- **Resource Overlap**: Have backup designer familiar with brand guidelines.
- **Brand Alignment**: Schedule monthly sync with marketing to ensure consistency.
- **Scope Creep**: PM to manage change requests; any new module requires design change brief.
- **Handoff Gaps**: Frontend to maintain component implementation checklist referencing design specs.

## 7. Success Criteria
- 95% of components implemented in code match Figma tokens within ±2px / color correctness.
- Stakeholder satisfaction survey ≥4.5/5 after Stage Gate 4.
- Reduced design debt: <5 outstanding design bugs per sprint post-launch.
