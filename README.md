# Inert PatchWRK Action consumer qualification

Synthetic test repository only; not a product, package or Action release.
Never install or execute fixtures/project dependencies, scripts or source files.
All API values and .env content are deliberately fake. No real credentials,
private source or customer data belong here.

The workflow calls only the exact reviewed public Action SHA on standard Ubuntu
with contents:read. It contains no schedules, deployments, secrets, comments,
cache or artifact uploads. Pull requests use the default merge/event commit as
inert target data; verification code comes from the trusted base checkout.
Only the two pre-agreed fixture-only PR branches are eligible for this test.

Accepted events: initial main push, one main workflow_dispatch, opened same-repo
PR, opened approved fork PR. Each event is one five-minute job; no retries.
Do not modify main, synchronize/reopen PRs, enable workflows on a fork, merge PRs
or change repository settings without explicit operator approval. Repo/fork
creation, pushes, dispatch and PR operations require separate founder authority.

The remote use is:
patchwrk-dev/patchwrk-scanner/action@542affc4913b5c3ee55b506470f36dc0304b17fb

No full release/support qualification is implied by these fixture tests. Static
compatibility findings are not production-health conclusions. Founder controls
review and later cleanup; do not delete or archive evidence automatically.
