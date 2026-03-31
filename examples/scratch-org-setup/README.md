# Scratch Org Setup Example

Complete scratch org configuration with definition file, setup scripts, and sample data.

## Structure

```text
config/
  project-scratch-def.json    # Scratch org definition
scripts/
  setup-scratch-org.sh        # Automated setup script
data/
  sample-accounts.json        # Sample data for development
sfdx-project.json             # Project configuration
```

## Scratch Org Definition

```json
{
  "orgName": "SCC Dev Scratch Org",
  "edition": "Developer",
  "features": [
    "EnableSetPasswordInApi",
    "Communities",
    "ServiceCloud",
    "LightningSalesConsole"
  ],
  "settings": {
    "lightningExperienceSettings": {
      "enableS1DesktopEnabled": true
    },
    "securitySettings": {
      "passwordPolicies": {
        "enableSetPasswordInApi": true
      }
    },
    "mobileSettings": {
      "enableS1EncryptedStoragePref2": false
    }
  }
}
```

## Project Configuration (sfdx-project.json)

```json
{
  "packageDirectories": [
    {
      "path": "force-app",
      "default": true
    }
  ],
  "namespace": "",
  "sfdcLoginUrl": "https://login.salesforce.com",
  "sourceApiVersion": "66.0"
}
```

## Setup Script

```bash
#!/bin/bash
set -e

ORG_ALIAS=${1:-dev-scratch}
DURATION=${2:-7}

echo "Creating scratch org: $ORG_ALIAS (${DURATION} days)"
sf org create scratch \
  --definition-file config/project-scratch-def.json \
  --alias "$ORG_ALIAS" \
  --duration-days "$DURATION" \
  --set-default \
  --wait 15

echo "Deploying source..."
sf project deploy start --target-org "$ORG_ALIAS"

echo "Assigning permission sets..."
sf org assign permset --name SCC_Admin --target-org "$ORG_ALIAS" || true

echo "Importing sample data..."
sf data import tree --files data/sample-accounts.json --target-org "$ORG_ALIAS" || true

echo "Running tests..."
sf apex run test --test-level RunLocalTests --target-org "$ORG_ALIAS" --result-format human

echo "Opening org..."
sf org open --target-org "$ORG_ALIAS"

echo "Scratch org $ORG_ALIAS is ready!"
```

## Sample Data

```json
{
  "records": [
    {
      "attributes": { "type": "Account", "referenceId": "AccRef1" },
      "Name": "Acme Corporation",
      "Industry": "Technology",
      "AnnualRevenue": 5000000,
      "NumberOfEmployees": 250
    },
    {
      "attributes": { "type": "Account", "referenceId": "AccRef2" },
      "Name": "Global Industries",
      "Industry": "Manufacturing",
      "AnnualRevenue": 12000000,
      "NumberOfEmployees": 1500
    }
  ]
}
```

## Lifecycle Commands

```bash
# Create
sf org create scratch -f config/project-scratch-def.json -a my-scratch -d 7

# Develop
sf project deploy start          # Push source
sf project retrieve start        # Pull changes from org

# Test
sf apex run test --test-level RunLocalTests

# Inspect
sf org display                   # Show org details
sf org open                      # Open in browser

# Cleanup
sf org delete scratch -o my-scratch --no-prompt
```
