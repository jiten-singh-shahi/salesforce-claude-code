---
name: sf-integration
description: >-
  Use when building Salesforce Apex integrations — REST/SOAP callouts, Named Credentials, inbound API, External Services. Do NOT use for Platform Events or Flow-only automation.
---

# Salesforce Integration Patterns

Procedures for building integrations between Salesforce and external systems. Limits, auth protocols, and pattern decision matrices live in the reference file.

@../_reference/INTEGRATION_PATTERNS.md

## When to Use

- Designing a new integration between Salesforce and an external system
- Choosing between REST callout, SOAP callout, Bulk API, or Composite API
- Implementing an inbound REST API endpoint in Salesforce
- Configuring Named Credentials and External Credentials for authentication
- Adding retry logic to callout classes for resilience
- Migrating from Connected Apps to External Client Apps (Spring '26+)

---

## Outbound REST Callout — Complete Pattern

```apex
public with sharing class OrderManagementIntegration {

    private static final String NAMED_CREDENTIAL = 'OrderManagementAPI';
    private static final Integer TIMEOUT_MS       = 10000;
    private static final Integer MAX_RETRIES      = 2;

    public static OrderResponse createExternalOrder(OrderRequest orderData) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint('callout:' + NAMED_CREDENTIAL + '/api/v2/orders');
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setHeader('Accept', 'application/json');
        req.setTimeout(TIMEOUT_MS);
        req.setBody(JSON.serialize(orderData));

        return executeWithRetry(req, MAX_RETRIES);
    }

    public static OrderResponse getOrderStatus(String externalOrderId) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint('callout:' + NAMED_CREDENTIAL +
            '/api/v2/orders/' + EncodingUtil.urlEncode(externalOrderId, 'UTF-8'));
        req.setMethod('GET');
        req.setHeader('Accept', 'application/json');
        req.setTimeout(TIMEOUT_MS);

        return executeWithRetry(req, MAX_RETRIES);
    }

    /**
     * In-transaction retry for transient network glitches.
     * For true backoff, use Queueable chaining with
     * AsyncOptions.minimumQueueableDelayInMinutes between attempts.
     */
    private static OrderResponse executeWithRetry(HttpRequest req, Integer retries) {
        Http http = new Http();
        HttpResponse res;
        Exception lastException;

        for (Integer attempt = 0; attempt <= retries; attempt++) {
            try {
                res = http.send(req);

                if (res.getStatusCode() == 200 || res.getStatusCode() == 201) {
                    return (OrderResponse) JSON.deserialize(
                        res.getBody(), OrderResponse.class);
                }

                if (res.getStatusCode() == 429) {
                    if (attempt == retries) {
                        throw new IntegrationException(
                            'Rate limited (429) after ' + (retries + 1) + ' attempts.');
                    }
                    continue;
                }

                if (res.getStatusCode() >= 500 && attempt < retries) continue;

                throw new IntegrationException(
                    'HTTP ' + res.getStatusCode() + ': ' + res.getBody());

            } catch (System.CalloutException e) {
                lastException = e;
                if (attempt == retries) {
                    throw new IntegrationException(
                        'Callout failed after ' + (retries + 1) +
                        ' attempts: ' + e.getMessage(), e);
                }
            }
        }
        throw new IntegrationException('Unexpected retry loop exit');
    }

    public class OrderRequest {
        public String  externalAccountId;
        public String  productCode;
        public Integer quantity;
        public Decimal unitPrice;
        public String  currency_x;
    }

    public class OrderResponse {
        public String orderId;
        public String status;
        public String message;
        public String createdAt;
    }

    public class IntegrationException extends Exception {}
}
```

---

## Named Credentials Setup

### Modern Model: External Credentials + Named Credentials (API 54.0+)

**Step 1 -- Create External Credential** (Setup > Security > Named Credentials > External Credentials)

- Principal type: `Named Principal` (shared credential) or `Per User` (each user authenticates separately)
- Authentication Protocol: OAuth 2.0, JWT Token, Basic, Custom Header, etc.

**Step 2 -- Create Named Credential** referencing the External Credential

- Name: `OrderManagementAPI`
- URL: `https://erp.example.com`
- External Credential: select from Step 1

**Step 3 -- Grant permission** via Permission Set on the External Credential Principal

```apex
// Usage in Apex — identical to legacy Named Credentials
req.setEndpoint('callout:OrderManagementAPI/api/v2/orders');
// Auth headers injected automatically
```

### Legacy Named Credentials

Still valid for simpler use cases. Combine URL + auth in one config.

```apex
req.setEndpoint('callout:LegacyNamedCred/endpoint');
```

---

## SOAP Callout via WSDL2Apex

```bash
# Generate Apex stub from WSDL
sf generate apex from-wsdl \
    --file path/to/service.wsdl \
    --output-dir force-app/main/default/classes
```

### Manual SOAP Callout (when WSDL2Apex is impractical)

```apex
public with sharing class SoapIntegration {

    private static final String SOAP_ENDPOINT = 'callout:LegacySoapService/service';

    public static String invokeMethod(String accountNumber) {
        String safeAccountNumber = escapeXml(accountNumber);

        String soapBody =
            '<?xml version="1.0" encoding="UTF-8"?>' +
            '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"' +
            '  xmlns:leg="http://legacy.example.com/service">' +
            '  <soapenv:Header/>' +
            '  <soapenv:Body>' +
            '    <leg:GetAccountDetails>' +
            '      <leg:AccountNumber>' + safeAccountNumber + '</leg:AccountNumber>' +
            '    </leg:GetAccountDetails>' +
            '  </soapenv:Body>' +
            '</soapenv:Envelope>';

        HttpRequest req = new HttpRequest();
        req.setEndpoint(SOAP_ENDPOINT);
        req.setMethod('POST');
        req.setHeader('Content-Type', 'text/xml; charset=UTF-8');
        req.setHeader('SOAPAction', '"GetAccountDetails"');
        req.setBody(soapBody);
        req.setTimeout(15000);

        HttpResponse res = new Http().send(req);

        if (res.getStatusCode() != 200) {
            throw new CalloutException('SOAP error: ' + res.getStatus());
        }

        Dom.Document doc       = res.getBodyDocument();
        Dom.XmlNode root       = doc.getRootElement();
        Dom.XmlNode body       = root.getChildElement(
            'Body', 'http://schemas.xmlsoap.org/soap/envelope/');
        Dom.XmlNode responseEl = body.getChildElements()[0];
        Dom.XmlNode result     = responseEl.getChildElement(
            'Result', 'http://legacy.example.com/service');

        return result != null ? result.getText() : null;
    }

    private static String escapeXml(String input) {
        if (String.isBlank(input)) return input;
        return input
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;')
            .replace('\'', '&apos;');
    }
}
```

---

## Inbound REST API

```apex
@RestResource(urlMapping='/v1/accounts/*')
global with sharing class AccountRestService {

    @HttpGet
    global static AccountDTO getAccount() {
        RestRequest  req = RestContext.request;
        RestResponse res = RestContext.response;

        String accountId = req.requestURI.substring(
            req.requestURI.lastIndexOf('/') + 1);

        if (String.isBlank(accountId)) {
            res.statusCode = 400;
            return new AccountDTO(null, null, 'Invalid Account ID');
        }
        try {
            Id.valueOf(accountId);
        } catch (StringException e) {
            res.statusCode = 400;
            return new AccountDTO(null, null, 'Invalid Account ID');
        }

        List<Account> accounts = [
            SELECT Id, Name, Phone, BillingCity, BillingCountry
            FROM Account WHERE Id = :accountId
            WITH USER_MODE LIMIT 1
        ];

        if (accounts.isEmpty()) {
            res.statusCode = 404;
            return new AccountDTO(null, null, 'Account not found');
        }

        res.statusCode = 200;
        return new AccountDTO(accounts[0].Id, accounts[0].Name, null);
    }

    @HttpPost
    global static AccountDTO createAccount() {
        RestRequest  req = RestContext.request;
        RestResponse res = RestContext.response;

        try {
            Map<String, Object> body =
                (Map<String, Object>) JSON.deserializeUntyped(
                    req.requestBody.toString());

            Account acc    = new Account();
            acc.Name       = (String) body.get('name');
            acc.Phone      = (String) body.get('phone');
            acc.BillingCity = (String) body.get('billingCity');

            if (String.isBlank(acc.Name)) {
                res.statusCode = 400;
                return new AccountDTO(null, null, 'Account name is required');
            }

            Database.insert(acc, AccessLevel.USER_MODE);
            res.statusCode = 201;
            return new AccountDTO(acc.Id, acc.Name, 'Account created');

        } catch (DmlException e) {
            res.statusCode = 400;
            return new AccountDTO(null, null, 'DML error: ' + e.getDmlMessage(0));
        } catch (JSONException e) {
            res.statusCode = 400;
            return new AccountDTO(null, null, 'Invalid JSON: ' + e.getMessage());
        } catch (System.SecurityException e) {
            res.statusCode = 403;
            return new AccountDTO(null, null, 'Insufficient access: ' + e.getMessage());
        }
    }

    global class AccountDTO {
        global String id;
        global String name;
        global String message;

        global AccountDTO(String id, String name, String message) {
            this.id      = id;
            this.name    = name;
            this.message = message;
        }
    }
}
```

---

## HttpCalloutMock -- Testing Callouts

### Single Endpoint Mock

```apex
@IsTest
public class OrderIntegrationMock implements HttpCalloutMock {

    private Integer statusCode;
    private String  body;

    public OrderIntegrationMock(Integer statusCode, String body) {
        this.statusCode = statusCode;
        this.body       = body;
    }

    public HttpResponse respond(HttpRequest req) {
        HttpResponse res = new HttpResponse();
        res.setStatusCode(statusCode);
        res.setHeader('Content-Type', 'application/json');
        res.setBody(body);
        return res;
    }
}
```

### Multi-Endpoint Mock

```apex
@IsTest
public class MultiRequestMock implements HttpCalloutMock {

    private Map<String, HttpCalloutMock> mocks = new Map<String, HttpCalloutMock>();

    public void addMock(String endpoint, HttpCalloutMock mock) {
        mocks.put(endpoint, mock);
    }

    public HttpResponse respond(HttpRequest req) {
        String endpoint = req.getEndpoint();
        for (String key : mocks.keySet()) {
            if (endpoint.contains(key)) {
                return mocks.get(key).respond(req);
            }
        }
        throw new IllegalArgumentException('Unexpected callout to: ' + endpoint);
    }
}
```

### Using Mocks in Tests

```apex
@IsTest
static void testCreateOrder_success_returnsOrderId() {
    String mockResponse =
        '{"orderId":"ERP-001","status":"PENDING","message":"Order created"}';
    Test.setMock(HttpCalloutMock.class,
        new OrderIntegrationMock(201, mockResponse));

    Test.startTest();
    OrderManagementIntegration.OrderRequest req =
        new OrderManagementIntegration.OrderRequest();
    req.productCode = 'PROD-001';
    req.quantity    = 5;
    req.unitPrice   = 99.99;

    OrderManagementIntegration.OrderResponse res =
        OrderManagementIntegration.createExternalOrder(req);
    Test.stopTest();

    System.assertEquals('ERP-001', res.orderId);
    System.assertEquals('PENDING', res.status);
}
```

---

## External Client Apps (Spring '26 GA)

External Client Apps replace Connected Apps for new OAuth-based integrations.

| Feature | Connected App | External Client App |
|---------|--------------|---------------------|
| Status | Existing -- maintain as-is | New standard for Spring '26+ |
| Location | Setup > App Manager | Setup > External Client App Manager |
| Metadata type | `ConnectedApp` | `ExternalClientApplication` |
| Recommendation | Keep existing; do not migrate | Use for all new integrations |

### Creating an External Client App (Metadata)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<ExternalClientApplication xmlns="http://soap.sforce.com/2006/04/metadata">
    <contactEmail>integrations@example.com</contactEmail>
    <description>OAuth integration with Warehouse Management System</description>
    <distributionState>Global</distributionState>
    <label>Warehouse Integration</label>
    <name>WarehouseIntegration</name>
</ExternalClientApplication>
```

```bash
sf project deploy start \
    --metadata ExternalClientApplication:WarehouseIntegration \
    --target-org Production
```

### Key Steps for New Integrations

1. Create External Client App in Setup > External Client Apps
2. Configure OAuth scopes and callback URLs
3. Reference the External Client App in your Named Credential's External Credential
4. Test OAuth flow in sandbox before production deployment

---

## Retry Pattern with Queueable

For callouts with transient failures, implement a retry Queueable:

```apex
public class RetryCalloutQueueable implements Queueable, Database.AllowsCallouts {

    private Id        recordId;
    private Integer   attemptNumber;
    private static final Integer MAX_ATTEMPTS = 3;

    public RetryCalloutQueueable(Id recordId, Integer attemptNumber) {
        this.recordId      = recordId;
        this.attemptNumber = attemptNumber;
    }

    public void execute(QueueableContext ctx) {
        try {
            ExternalIntegration.sync(recordId);
            update new MyRecord__c(
                Id             = recordId,
                Sync_Status__c = 'Success',
                Last_Sync__c   = Datetime.now()
            );
        } catch (Exception e) {
            if (attemptNumber < MAX_ATTEMPTS) {
                System.enqueueJob(
                    new RetryCalloutQueueable(recordId, attemptNumber + 1));
            } else {
                update new MyRecord__c(
                    Id             = recordId,
                    Sync_Status__c = 'Failed',
                    Sync_Error__c  = e.getMessage()
                );
            }
        }
    }
}
```

---

## Related

- Agent: `sf-integration-agent` -- for interactive, in-depth guidance
- Constraints: sf-apex-constraints, sf-security-constraints
- Reference: @../_reference/INTEGRATION_PATTERNS.md
