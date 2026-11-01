# UGREEN review material (public, no personal data)

Documents prepared for the UGREEN App Center re-review of MOVVIZ. Anything personal
(identity of the publisher, signed forms, ID documents) stays out of this repository and
goes only into the private submission folder.

| File | Purpose |
| --- | --- |
| `MOVVIZ_WORKFLOW_EN.md` | Main workflow, written for the UGREEN test team |
| `PRIVACY_DATAFLOW_SUMMARY.md` | What the code stores, sends and where (basis of the public policy) |
| `UGREEN_SELF_TEST_PLAN.csv` | Self-test plan with honest statuses (`PASS` only with evidence; `NOT TESTED` otherwise) |

Public pages served by the application itself: `/privacy` and `/help` (no login). The
privacy text lives in `src/lib/legal/content.ts`; change it together with
`PRIVACY_POLICY_VERSION` in `src/lib/privacy/consent.ts` when the real behavior changes.

The consent checkbox only appears with `MOVVIZ_REQUIRE_PRIVACY_CONSENT=1`, which only the
UGREEN compose file sets. Other distributions are unchanged.

The official UGREEN files (Docker self-test workbook, Application Form, Developer Commitment
Letter) must be filled from the originals received by email; copy values from this folder and
from the private submission folder.
