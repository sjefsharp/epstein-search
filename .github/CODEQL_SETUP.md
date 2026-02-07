# CodeQL Setup Instructions

The CodeQL workflow in this repository requires GitHub Advanced Security to be enabled.

## For Public Repositories

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Security** → **Code security and analysis**
3. Find the **Code scanning** section
4. Click **Set up** → **Default** or **Advanced**
5. The CodeQL workflow will now run successfully

## For Private Repositories

Advanced Security requires a GitHub Enterprise subscription for private repositories.

## Alternative: Disable CodeQL Workflow

If you don't need code scanning, you can disable the workflow:

1. Go to **Settings** → **Actions** → **General**
2. Find the CodeQL workflow
3. Disable it

Or simply delete the `.github/workflows/codeql.yml` file.

## Troubleshooting

If the workflow fails with "Code scanning is not enabled for this repository", it means Advanced Security is not enabled. Follow the steps above to enable it.
