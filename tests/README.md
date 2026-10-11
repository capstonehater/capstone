# Project tests

Run from the project root in a terminal:

```powershell
python tests/run_tests.py
```

Run one suite with `python tests/run_tests.py --suite backend` (or `--suite frontend`).

Backend Jest tests load `tests/backend/setup-env.cjs` for test-only credentials, a dummy database URL, and disabled background jobs. Tests use mocked database clients; production configuration validation remains enabled in the application.

The runner executes frontend, backend, forecasting, store recommendation, and release packaging unit tests. Output streams to the terminal, including full assertion errors and tracebacks. Each run saves separate suite logs and `summary.json` in `tests/results/<timestamp>/`. A nonzero exit code means at least one suite failed. Existing tests stay in their component folders to preserve relative imports. Database integration and end-to-end tests are not included.
