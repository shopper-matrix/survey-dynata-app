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

## Open questions for Dynata

1. **Quality terminations:** the API returns no quality link. Which link / `rst` should
   respondents removed for quality (speeders, attention checks, bots) receive?
2. **Entry link:** do you append `project`, `psid`, `_k` and `_s` to the base URL we provide? Are
   other parameters sent (country, language)?
3. **API operations:** rate limits, expected response time, behaviour when the API is
   unavailable, and a test environment or test key ID?
4. **End links:** are they bound to the respondent, and how long do they stay valid?
5. **Secret:** how is it delivered and rotated (does the key ID change)?
6. **Test links and certification:** how do you run them and what do you need from us?
7. **Post-field quality removals:** how do we report them and get replacements?
8. **Project / quota API:** is there one, and how do we get access?
9. **Restrictions:** data we may collect, hosting location, and publishing this integration as
   open source (the endpoint and algorithm appear in our public code).
