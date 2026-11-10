# Dynata integration

What we know about Dynata's requirements (DSA-106) and how the app implements them. Secrets are
never written here: the key ID and secret live in `.env` locally and in the hosting secret store.

Source: Dynata, "Signed URL Start-End API" (August 2025), in
[docs/Signed-Links-API-Dynata-Aug2025pdf.pdf](Signed-Links-API-Dynata-Aug2025pdf.pdf) if present.

## Confirmed

| Topic | Answer |
| --- | --- |
| Signing | HMAC-SHA256, hex-encoded, appended as `_s`. Covers entry and end links. |
| What is signed | The URL's path and query exactly as sent, without scheme/host and up to (excluding) `&_s=`. E.g. `/?project=10001&psid=…&_k=1234`. Reproduced from Dynata's own example (`apps/api/src/dynata/signature.test.ts`). |
| Credentials | One **key ID** (`_k`) and one **secret** per client (us), issued by Dynata. Not per survey. |
| Entry link parameters | `project` (Dynata project), `psid` (respondent ID), `_k` (key ID), `_s` (signature). |
| Recommended flow | On entry, `POST https://passphrase.dynata.com/v1/links/buildAndValidate` with `{ keyId, secret, url: <entry URL> }`. |
| API response | `verification` (`success` / `failure`), `expectedSignature` (debugging), `errorMessage`, `completeLink` (`rst=1`), `screenOutLink` (`rst=2`), `overQuotaLink` (`rst=3`), `invalidSignatureLink` (`rst=2&svFlag=1`). |
| Failed verification | Terminate and send the respondent to `invalidSignatureLink`. |

## How the app uses it

- `DYNATA_MODE=live`: `apps/api/src/dynata/client.ts` calls the API above (5 s timeout) once per
  entering respondent. The returned, already signed end links are stored for that respondent
  (DSA-302/303) and used on finish (DSA-305), so refreshing always returns the same link.
- `DYNATA_MODE=mock` (default): the same interface works locally. Entry links are verified with
  the documented algorithm and the mock credentials; end links point at
  `<APP_BASE_URL>/mock-dynata/end?project=…&psid=…&rst=…` and are signed the same way.
- Per survey the database stores only the Dynata **project ID** (`DynataSurveySettings`).
- The link we give Dynata for a survey is `<APP_BASE_URL>/s/<surveyId>`.

## From the help article "Surveys: Survey Details, Links & Redirects"

Source: help.dynata.com, Dynata+ Sample › Create a Project (printed 9 Nov 2026), saved as
`docs/Survey Details, Links & Redirects.pdf` if present.

| Topic | What the article says |
| --- | --- |
| Security modes (per project) | **Dynata Secured Links (End)** — "most data platforms"; **Dynata Secured Links (Start-End)** — for listed platforms; **Survey Platform Security** (unsigned). Signed vs unsigned must match exactly; don't switch a project during testing, create a new one. |
| Entry link | Our survey URL; Dynata appends `psid` (always) plus optional data appends `age`, `gender` (1 = Male, 2 = Female), `region` (coded, lookup file). Signed start links also carry `_k`, `_d` and `_s`. `project` is **not** mentioned; `_d` is undocumented (looks like `<id>/<code>`). |
| End links | `https://dkr1.ssisurveys.com/projects/end?rst=…&psid=…` — complete `rst=1`, screen-out `rst=2`, over-quota `rst=3`, **quality `rst=2&qflag=…`** (value `1` in the unsigned table, `2` in the signed table; spelled `qFlag` in screenshots), invalid start signature `rst=2&svFlag=1`. The unchanged `psid` must be returned. |
| Signing end links ourselves | HMAC-SHA256 with the secret over path + query, e.g. `/projects/end?rst=1&psid=…&_k=…`, without the domain; `&_s=<signature>` must be the last parameter; a new signature per respondent and outcome. Same algorithm as our `signature.ts`. |
| Testing | At least one completed test is required before launch; a signed test project should have one question whose answers redirect through each signed end link. Typical errors: empty or literal `{psid}`, wrong `rst`, signed/unsigned mismatch (HTTP 400). |

**Consequences for the backlog (DSA-303…305):**

- Quality terminations have a link after all: `rst=2&qflag=…` (value to confirm). Our current
  stand-in (screen-out link) should change.
- We could build and sign end links ourselves ("End" mode) instead of relying on the
  `buildAndValidate` API ("Start-End" mode). Which mode Dynata sets up for us must be confirmed.
- The `project` parameter may not be sent at all, so a project check must not depend on it.

## Open questions for Dynata

1. **Quality terminations:** the API returns no quality link, the help article says
   `rst=2&qflag=1` (unsigned) and `rst=2&qflag=2` (signed). Which exact value and spelling?
2. **Entry link:** which security mode will our projects use (End, Start-End or unsigned)? Is
   `project` sent at all, what is `_d`, and should end links echo `_d`?
3. **API operations:** rate limits, expected response time, behaviour when the API is
   unavailable, and a test environment or test key ID?
4. **End links:** are they bound to the respondent, and how long do they stay valid?
5. **Secret:** how is it delivered and rotated (does the key ID change)?
6. **Test links and certification:** how do you run them and what do you need from us?
7. **Post-field quality removals:** how do we report them and get replacements?
8. **Project / quota API:** is there one, and how do we get access?
9. **Restrictions:** data we may collect, hosting location, and publishing this integration as
   open source (the endpoint and algorithm appear in our public code).
