# ZetaSports 12-Agent Development Team: Architecture, Operating Specifications & Lifecycle

## 1. Executive Overview

The ZetaSports platform engineering and visual remediation initiative is executed by an autonomous, highly coordinated **12-Agent Development Team**. The team operates under strict software engineering disciplines, separation of concerns, and automated quality gates. 

Every agent represents a specialized engineering role with defined inputs, outputs, verification methods, and peer collaboration contracts. All work progresses through a sequential, gated **10-Stage Workflow Lifecycle** designed to eliminate defects, verify cross-device visual harmony, protect cybersecurity perimeters, and deliver zero-defect software.

---

## 2. The 10-Stage Workflow Lifecycle

The development lifecycle enforces progressive verification. No stage may transition to the next without fulfilling explicit gate acceptance criteria.

```mermaid
flowchart LR
    S1[1. REQUIREMENTS] --> S2[2. PLANNING]
    S2 --> S3[3. ARCHITECTURE]
    S3 --> S4[4. DESIGN]
    S4 --> S5[5. DEVELOPMENT]
    S5 --> S6[6. INTEGRATION]
    S6 --> S7[7. TESTING]
    S7 --> S8[8. SECURITY AUDIT]
    S8 --> S9[9. CODE REVIEW]
    S9 --> S10[10. DEPLOYMENT]

    style S1 fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#fff
    style S2 fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#fff
    style S3 fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#fff
    style S4 fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#fff
    style S5 fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#fff
    style S6 fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#fff
    style S7 fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#fff
    style S8 fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#fff
    style S9 fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#fff
    style S10 fill:#1e293b,stroke:#10b981,stroke-width:2px,color:#fff
```

### Stage Breakdown & Gating Criteria:

| Stage # | Stage Name | Lead Agent | Inputs | Primary Outputs | Exit Gate Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Stage 1** | **REQUIREMENTS** | Product Manager | User prompt, baseline screenshots, live site URLs | `project/docs/PRD.md`, `project/agent-reports/product-manager.md` | Complete functional, responsive, and cybersecurity requirements documented and prioritized (MoSCoW). |
| **Stage 2** | **PLANNING** | Main Orchestrator | PRD, project scope, team roster | Milestone schedule (M1-M6), task dispatch manifests, `project/README.md` | Work breakdown structure approved; dependency graph resolved; subagents dispatched. |
| **Stage 3** | **ARCHITECTURE** | System Architect | PRD, existing XML templates, CSS assets | `project/docs/ARCHITECTURE.md`, `project/agent-reports/architect.md` | 2-Blogger topology formalized; cross-domain communication contract locked; CDN strategy ratified. |
| **Stage 4** | **DESIGN** | UI/UX Designer | Baseline screenshots, CSS audit reports | `project/docs/DESIGN_SYSTEM.md`, `project/agent-reports/designer.md` | Design tokens defined (colors, spacing, typography, breakpoints); 44px touch targets mapped; collision fixes specified. |
| **Stage 5** | **DEVELOPMENT** | Frontend, Backend, Database Engineers | Architecture specs, design system, database DDL | `web/css/zetasports-core.css`, patched theme XMLs, `DATABASE_SCHEMA.md`, `API_DOCUMENTATION.md` | Zero inline duplicate CSS; XML well-formedness verified; Supabase schemas and endpoints validated. |
| **Stage 6** | **INTEGRATION** | Frontend & Backend Engineers | Core CSS, theme XMLs, Supabase backend | Integrated theme packages, DOM node compliance report | All 24 core DOM container IDs operational; cross-domain parameter passing verified. |
| **Stage 7** | **TESTING** | QA Engineer & Logic Tester | Integrated themes, responsive viewports | `project/tests/functional/`, `tests/responsive/`, `tests/logic/`, QA & Logic reports | 100% pass on 42-check collision audit; zero horizontal overflow on 390px and 1280px; zero unhandled edge cases. |
| **Stage 8** | **SECURITY AUDIT** | Cybersecurity Engineer | Theme XMLs, JavaScript handlers, Supabase endpoints | `project/docs/SECURITY_REQUIREMENTS.md`, `project/tests/security/`, Security report | Zero secret leaks; strict iframe sandboxing verified; XSS sanitizers (`escapeHtml`, `sanitizeUrl`) passing 100% test coverage. |
| **Stage 9** | **CODE REVIEW** | Code Reviewer | Git diffs, test logs, code quality audits | `project/agent-reports/code-review.md`, forensic verification sign-off | Clean code review pass; byte mirror parity between themes verified; zero anti-patterns or hardcoded stubs. |
| **Stage 10** | **DEPLOYMENT** | Deployment & DevOps Engineer | Verified release artifacts, deployment guides | `project/src/` release package, `project/agent-reports/deployment.md`, CDN deployment scripts | Themes deployed to Blogger; CSS synced to Supabase Storage and jsDelivr; visual before/after verification complete. |

---

## 3. 12-Agent Roster: Roles, Responsibilities & Operational Specifications

### 1. Main Orchestrator
- **Role**: Executive Coordinator & Systems Synthesizer.
- **Responsibilities**:
  - Maintains global task registry and milestone lifecycle gating (M1 through M6).
  - Decomposes high-level requirements into atomic agent work packages.
  - Resolves cross-agent blockers, reviews handoff reports, and dispatches downstream tasks.
  - Performs final release attestation and user communication.
- **Inputs**: User prompts, milestone status, agent handoff reports.
- **Outputs**: Dispatch orders, milestone status tracking, synthesized release deliverables.
- **Verification**: Milestone checklist completion, cross-agent dependency integrity.

### 2. Product Manager (PM)
- **Role**: Product Strategist & Requirements Authority.
- **Responsibilities**:
  - Authors the master Product Requirements Document (`project/docs/PRD.md`).
  - Defines user personas, end-to-end user journeys, and functional feature specs.
  - Establishes responsive UI criteria (390px/1280px zero overflow, 44px touch targets).
  - Manages MoSCoW feature prioritization and release gating criteria.
- **Inputs**: User request, baseline screenshots, live portal URLs, domain context.
- **Outputs**: `project/README.md`, `project/AGENTS.md`, `project/docs/PRD.md`, `project/agent-reports/product-manager.md`.
- **Verification**: Requirements coverage traceability matrix, stakeholder acceptance sign-off.

### 3. System Architect
- **Role**: Enterprise Architect & Topology Designer.
- **Responsibilities**:
  - Designs and documents the decoupled 2-Blogger architecture (KeralaHub + ZetaSports).
  - Specifies cross-domain navigation contracts (`window.ZETA_CONFIG`) and URL query schema.
  - Defines Master CSS Single-Source-of-Truth (SOT) CDN distribution model.
  - Formulates fault-tolerant streaming gateway and fallback mechanics.
- **Inputs**: PRD, legacy theme XMLs, Supabase infrastructure details.
- **Outputs**: `project/docs/ARCHITECTURE.md`, `project/agent-reports/architect.md`.
- **Verification**: Architecture diagram completeness, CDN failover topology validation.

### 4. UI/UX Designer
- **Role**: Design System Architect & Visual Quality Lead.
- **Responsibilities**:
  - Establishes unified Design System (`project/docs/DESIGN_SYSTEM.md`) encompassing color tokens, typography scales, spacing units, and elevation shadows.
  - Defines responsive viewport breakpoints: Mobile Compact (360px), Mobile Standard (390px), Tablet (768px-1024px), Desktop (1280px+).
  - Specifies anti-collision layout rules (flex-basis, min-width containment, text-overflow truncation).
  - Audits baseline screenshots and dictates before/after visual remediation rules.
- **Inputs**: PRD, baseline screenshot gallery, CSS collision audit data.
- **Outputs**: `project/docs/DESIGN_SYSTEM.md`, `project/agent-reports/designer.md`.
- **Verification**: 100% adherence to WCAG AAA 44px touch targets, zero typographic overlaps.

### 5. Frontend Developer
- **Role**: Master CSS & Blogger XML Template Engineer.
- **Responsibilities**:
  - Refactors and maintains the centralized stylesheet `web/css/zetasports-core.css`.
  - Strips inline duplicate CSS from `zetasports-colorify-blogger-theme.xml` and `zetasports-korra-blogger-theme.xml`.
  - Implements responsive anti-collision layout rules across home fixtures, match details, and stream views.
  - Fixes unstyled match scoreboard containers and broken navigation controls.
  - Maintains strict byte-parity between root Colorify theme and `zetasports-v3` mirror.
- **Inputs**: Design system tokens, architecture specs, legacy XML files.
- **Outputs**: Patched `web/css/zetasports-core.css`, patched theme XMLs, `project/agent-reports/frontend.md`.
- **Verification**: XML well-formedness validation (`System.Xml`), SHA-256 mirror parity check.

### 6. Backend Developer
- **Role**: API Gateway & Integration Engineer.
- **Responsibilities**:
  - Authors `project/docs/API_DOCUMENTATION.md` detailing all internal and external REST interfaces.
  - Manages Supabase REST endpoints, crawler data synchronization, and FotMob live score proxies.
  - Implements stream health validation, fallback streaming playlists, and server switcher payloads.
  - Enforces client API query rate-limiting and response caching strategies.
- **Inputs**: Database schema, architecture specs, stream source contracts.
- **Outputs**: `project/docs/API_DOCUMENTATION.md`, edge functions, backend integration logic, `project/agent-reports/backend.md`.
- **Verification**: REST API HTTP 200 response validation, JSON schema conformance tests.

### 7. Database Engineer
- **Role**: Data Architect & SQL Optimization Engineer.
- **Responsibilities**:
  - Documents and refines the complete database schema (`project/docs/DATABASE_SCHEMA.md`).
  - Manages tables: `matches`, `leagues`, `teams`, `stream_sources`, `crawler_logs`.
  - Designs and verifies Row Level Security (RLS) policies protecting data confidentiality.
  - Creates indexes on frequent query paths (`match_time`, `league_id`, `status`).
- **Inputs**: Backend API requirements, data pipeline schemas, Supabase project configuration.
- **Outputs**: `project/docs/DATABASE_SCHEMA.md`, DDL migration scripts, `project/agent-reports/database.md`.
- **Verification**: SQL syntax execution, RLS authorization matrix verification, index explain-plans.

### 8. QA Engineer
- **Role**: Functional Testing & Verification Lead.
- **Responsibilities**:
  - Develops and executes automated test suites in `project/tests/functional/` and `project/tests/integration/`.
  - Verifies DOM node structural integrity across all 24 required container IDs (`#homeView`, `#matchView`, `#linksView`, `#streamView`, etc.).
  - Validates interactive controls: date switcher tabs, league filters, search modal, and server switcher.
  - Validates cross-browser rendering across Chromium, Firefox, and WebKit rendering engines.
- **Inputs**: Integrated theme files, CSS stylesheet, test scenarios from PRD.
- **Outputs**: Automated functional test harness, test execution logs, `project/agent-reports/qa.md`.
- **Verification**: 100% test pass rate on functional and integration assertions.

### 9. Logic & Edge Case Tester
- **Role**: Boundary Condition & Resiliency Specialist.
- **Responsibilities**:
  - Authors and executes edge-case test suite in `project/tests/logic/`.
  - Validates date switcher boundaries (midnight UTC rollover, leap years, timezone offsets).
  - Tests null/empty data states: leagues with zero fixtures, matches with missing team crests, absent stream links.
  - Tests simulated network failures: Supabase REST timeout, CDN latency, corrupt JSON payloads.
- **Inputs**: PRD edge-case specifications, backend error formats, date switcher logic.
- **Outputs**: `project/tests/logic/`, edge-case verification report, `project/agent-reports/logic-tester.md`.
- **Verification**: Zero uncaught exceptions, graceful UI fallback rendering on all failure modes.

### 10. Cybersecurity Engineer
- **Role**: Security Architect & Vulnerability Auditor.
- **Responsibilities**:
  - Authors `project/docs/SECURITY_REQUIREMENTS.md` covering OWASP Top 10 web security compliance.
  - Enforces mandatory HTML escaping (`escapeHtml`) on all dynamic match metadata.
  - Enforces strict URL sanitization (`sanitizeUrl`) and open-redirect protection (`isAllowedUrl`).
  - Validates iframe sandboxing (`allow-scripts allow-same-origin allow-forms allow-presentation`) and anti-clickjacking policies.
  - Audits codebase for credential leaks, ensuring only public anon keys are exposed.
- **Inputs**: Theme XML templates, JavaScript modules, network request logs.
- **Outputs**: `project/docs/SECURITY_REQUIREMENTS.md`, `project/tests/security/`, `project/agent-reports/security.md`.
- **Verification**: Automated security test suite pass, zero high/critical vulnerabilities identified.

### 11. Code Reviewer
- **Role**: Independent Code Quality & Integrity Auditor.
- **Responsibilities**:
  - Conducts static code analysis and peer reviews on all modified XML, CSS, and JS files.
  - Enforces clean code principles: DRY (Don't Repeat Yourself), separation of concerns, zero code bloat.
  - Validates that no shortcuts, dummy facades, or hardcoded mock data exist in source code.
  - Verifies strict byte-parity across mirrored theme templates.
- **Inputs**: Git diffs, modified files, test execution logs, agent handoffs.
- **Outputs**: Comprehensive review audit, approval sign-off, `project/agent-reports/code-review.md`.
- **Verification**: 100% compliance with code layout standards and integrity mandates.

### 12. Deployment & DevOps Engineer
- **Role**: Release Engineering & Cloud Infrastructure Lead.
- **Responsibilities**:
  - Packages final release deliverables in `project/src/` with release manifest and SHA-256 checksums.
  - Coordinates deployment to Supabase Storage CDN and jsDelivr GitHub releases.
  - Authors step-by-step Blogger XML update guides for KeralaHub and ZetaSports.
  - Executes automated responsive layout checks (`scratch/verify_responsive_layout.mjs`) and generates before/after screenshot comparisons.
- **Inputs**: Approved theme XMLs, core CSS, verification logs, code review approval.
- **Outputs**: `project/src/` release package, deployment documentation, `project/agent-reports/deployment.md`.
- **Verification**: Production HTTP 200 checks, CDN cache invalidation verification, visual layout comparison.

---

## 4. Agent Collaboration & Dependency Matrix

The matrix below illustrates the directional flow of requirements, specifications, and artifacts between the 12 agents:

| Producing Agent $\downarrow$ \ Consuming Agent $\rightarrow$ | Orch | PM | Arch | Des | Front | Back | DB | QA | Logic | Sec | Rev | DevOps |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Orchestrator** | -- | Dispatch | Dispatch | Dispatch | Dispatch | Dispatch | Dispatch | Dispatch | Dispatch | Dispatch | Dispatch | Dispatch |
| **2. Product Manager** | Status | -- | PRD | PRD | PRD | PRD | PRD | User Stories | Edge Cases | Sec Req | Review Scope | Release Criteria |
| **3. System Architect** | Status | Feedback | -- | Layout Spec | Tech Contract | API Specs | DB Topology | Test Contract | Latency Model | Threat Model | Arch Rules | Topology |
| **4. UI/UX Designer** | Status | UX Alignment | Layout Spec | -- | Tokens/CSS | UX Specs | -- | Visual Tests | State Specs | -- | Style Guide | Asset Spec |
| **5. Frontend Dev** | Status | -- | Contract Check | Token Impl | -- | API Consumed | Data Binding | Test Artifact | Test Artifact | Sanitized DOM | Code Diff | Source Package |
| **6. Backend Dev** | Status | -- | API Model | -- | REST Schema | -- | Query Needs | API Mock | Fallbacks | Auth Scopes | Code Diff | API Endpoints |
| **7. Database Eng** | Status | -- | DB Topology | -- | Schema Types | Schema/DDL | -- | Fixture Data | Boundary Data | RLS Rules | DDL Diff | Migration Scripts|
| **8. QA Engineer** | Test Gate | Coverage | -- | Visual Report | Bug Reports | API Bugs | Data Bugs | -- | Test Matrix | Test Pass | Test Logs | Test Sign-off |
| **9. Logic Tester** | Logic Gate| -- | -- | -- | Bug Reports | Fallback Bugs| Edge Data | Matrix Sync | -- | Bypass Checks | Test Logs | Stability Pass |
| **10. Security Eng** | Sec Gate | -- | Threat Review | -- | Sanitize Fix | Scope Scrutiny| RLS Audit | Sec Matrix | Fuzz Matrix | -- | Sec Audit | Sec Sign-off |
| **11. Code Reviewer** | Quality Gate| -- | Arch Review | -- | Style Changes | Refactor Req | Index Review | Test Coverage| Test Coverage | Sec Review | -- | Merge Sign-off |
| **12. DevOps Eng** | Release Done| PM Notice | Deploy Plan | Visual Proof | Deployed XML | Deployed Endpt| Deployed DDL | Staging Env | Staging Env | TLS/CDN Conf | Pre-deploy | -- |

---

## 5. Team Operating Protocols & Quality Gates

To prevent regressions, maintain integrity, and ensure auditability, all 12 agents operate under strict engineering mandates:

### Protocol 1: Evidence-Based Deliverables
No task may be marked as complete without empirical verification evidence, including:
- Automated test runner logs showing total checks executed and zero failures.
- Terminal output logs showing successful command exits (exit code 0).
- File SHA-256 hashes verifying identity and synchronization.
- Visual screenshot logs confirming responsive stability across target viewports.

### Protocol 2: Centralized Single-Source-of-Truth (SOT) Stylesheet
All custom styling must reside in `web/css/zetasports-core.css`. 
- No inline `<style>` blocks in theme templates for custom component designs.
- Any modification to styling must be made to the master CSS file, verified locally, and deployed to Supabase Storage CDN.

### Protocol 3: Byte-for-Byte Mirror Parity
The primary Colorify theme `zetasports-colorify-blogger-theme.xml` and its mirror `zetasports-v3/web/colorify_zetasports_theme.xml` must remain 100% byte-identical. Any commit modifying one must simultaneously update the other with identical SHA-256 checksums.

### Protocol 4: Mandatory Cybersecurity Controls
- **Input Sanitization**: All user-controlled text and API payload fields rendered in the DOM must pass through `escapeHtml()`:
  ```javascript
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  ```
- **URL Scheme Validation**: All link targets, image sources, and redirect destinations must pass through `sanitizeUrl()`:
  ```javascript
  function sanitizeUrl(url) {
    if (!url) return '';
    var trimmed = String(url).trim();
    if (/^(https?:|\/)/i.test(trimmed) && !/^javascript:/i.test(trimmed)) {
      return trimmed;
    }
    return '';
  }
  ```
- **Anti-Open Redirect**: Cross-domain navigation destinations must be checked against `isAllowedUrl()`, explicitly forbidding protocol-relative bypasses:
  ```javascript
  function isAllowedUrl(url) {
    if (!url) return false;
    var trimmed = String(url).trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) return false;
    try {
      var parsed = new URL(trimmed, window.location.origin);
      var allowedHosts = ['www.keralahub.online', 'keralahub.online', 'www.zetasports.site', 'zetasports.site'];
      return allowedHosts.includes(parsed.hostname);
    } catch(e) {
      return false;
    }
  }
  ```
- **Iframe Sandboxing**: All third-party video players and streaming embeds must strictly specify:
  `sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"` and `referrerpolicy="no-referrer"`.

### Protocol 5: Mandatory Forensic Integrity Mandate
- No hardcoded test results, expected outputs, or fake verification strings in source code.
- No dummy or facade implementations that return pre-calculated responses without authentic logic.
- Every module must maintain genuine application state and produce real behavior.
- Independent forensic audit agents inspect all artifacts before final sign-off.
