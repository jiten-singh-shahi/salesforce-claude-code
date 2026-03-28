# External Integration with Named Credentials

Secure external API integration using Named Credentials, HTTP callout service, retry handling, async processing, and test mocking.

## When to Use This Pattern

- Calling external REST APIs from Salesforce (payment gateways, ERPs, shipping providers)
- Building callouts that need authentication managed by the platform
- Implementing retry logic for transient network failures
- Processing callouts asynchronously to avoid governor limits in synchronous contexts
- Writing testable integration code with `HttpCalloutMock`

## Structure

```text
force-app/main/default/
  namedCredentials/
    Payment_Gateway.namedCredential-meta.xml
  externalCredentials/
    Payment_Gateway_Credential.externalCredential-meta.xml
  classes/
    PaymentGatewayService.cls         # HTTP callout service
    PaymentGatewayService_Test.cls    # Test with mock
    PaymentGatewayQueueable.cls       # Async callout wrapper
    PaymentGatewayMock.cls            # HttpCalloutMock implementation
```

## Named Credential Setup

```xml
<!-- Payment_Gateway.namedCredential-meta.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<NamedCredential xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Payment_Gateway</fullName>
    <label>Payment Gateway</label>
    <type>SecuredEndpoint</type>
    <url>https://api.paymentgateway.example.com/v2</url>
    <externalCredential>Payment_Gateway_Credential</externalCredential>
    <allowMergeFieldsInBody>false</allowMergeFieldsInBody>
    <allowMergeFieldsInHeader>false</allowMergeFieldsInHeader>
    <generateAuthorizationHeader>true</generateAuthorizationHeader>
</NamedCredential>
```

```xml
<!-- Payment_Gateway_Credential.externalCredential-meta.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<ExternalCredential xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Payment_Gateway_Credential</fullName>
    <label>Payment Gateway Credential</label>
    <authenticationProtocol>Custom</authenticationProtocol>
    <externalCredentialParameters>
        <parameterName>Authorization</parameterName>
        <parameterType>AuthHeader</parameterType>
    </externalCredentialParameters>
</ExternalCredential>
```

## HTTP Callout Service Class

```apex
public with sharing class PaymentGatewayService {

    private static final String NAMED_CREDENTIAL = 'callout:Payment_Gateway';
    private static final Integer DEFAULT_TIMEOUT = 30000; // 30 seconds

    /**
     * Charges a payment method. Returns a PaymentResult with success/failure details.
     */
    public static PaymentResult chargePayment(String paymentMethodId, Decimal amount, String currency_x) {
        Map<String, Object> requestBody = new Map<String, Object>{
            'payment_method' => paymentMethodId,
            'amount' => (amount * 100).intValue(), // Convert to cents
            'currency' => currency_x,
            'capture' => true
        };

        HttpResponse response = sendRequest('POST', '/charges', JSON.serialize(requestBody));
        return parsePaymentResponse(response);
    }

    /**
     * Retrieves the status of an existing charge.
     */
    public static PaymentResult getChargeStatus(String chargeId) {
        HttpResponse response = sendRequest('GET', '/charges/' + chargeId, null);
        return parsePaymentResponse(response);
    }

    /**
     * Core HTTP request method. All callouts route through here.
     */
    private static HttpResponse sendRequest(String method, String path, String body) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint(NAMED_CREDENTIAL + path);
        req.setMethod(method);
        req.setTimeout(DEFAULT_TIMEOUT);
        req.setHeader('Content-Type', 'application/json');
        req.setHeader('Accept', 'application/json');
        req.setHeader('Idempotency-Key', generateIdempotencyKey());

        if (body != null) {
            req.setBody(body);
        }

        Http http = new Http();
        return http.send(req);
    }

    private static PaymentResult parsePaymentResponse(HttpResponse response) {
        PaymentResult result = new PaymentResult();
        result.statusCode = response.getStatusCode();

        if (response.getStatusCode() == 200 || response.getStatusCode() == 201) {
            Map<String, Object> responseBody = (Map<String, Object>) JSON.deserializeUntyped(response.getBody());
            result.success = true;
            result.chargeId = (String) responseBody.get('id');
            result.status = (String) responseBody.get('status');
        } else {
            result.success = false;
            result.errorMessage = 'HTTP ' + response.getStatusCode() + ': ' + response.getBody();
        }

        return result;
    }

    private static String generateIdempotencyKey() {
        Blob randomBytes = Crypto.generateAesKey(128);
        return EncodingUtil.convertToHex(randomBytes);
    }

    public class PaymentResult {
        @AuraEnabled public Boolean success;
        @AuraEnabled public String chargeId;
        @AuraEnabled public String status;
        @AuraEnabled public String errorMessage;
        @AuraEnabled public Integer statusCode;
    }
}
```

## Retry and Error Handling

```apex
public with sharing class CalloutRetryHelper {

    private static final Integer MAX_RETRIES = 3;
    private static final Set<Integer> RETRYABLE_STATUS_CODES = new Set<Integer>{
        408, 429, 500, 502, 503, 504
    };

    /**
     * Executes an HTTP request with exponential backoff retry.
     * Only retries on transient errors (5xx, 408, 429).
     */
    public static HttpResponse sendWithRetry(HttpRequest request) {
        Integer attempts = 0;
        HttpResponse response;
        Http http = new Http();

        while (attempts < MAX_RETRIES) {
            attempts++;
            try {
                response = http.send(request);

                if (!RETRYABLE_STATUS_CODES.contains(response.getStatusCode())) {
                    return response;
                }

                System.debug(LoggingLevel.WARN,
                    'Retryable status ' + response.getStatusCode()
                    + ' on attempt ' + attempts + ' of ' + MAX_RETRIES
                );
            } catch (CalloutException e) {
                System.debug(LoggingLevel.ERROR,
                    'Callout exception on attempt ' + attempts + ': ' + e.getMessage()
                );
                if (attempts >= MAX_RETRIES) {
                    throw e;
                }
            }

            // Note: Apex does not support Thread.sleep(). In synchronous context,
            // retries happen immediately. For true backoff, use Queueable chaining.
        }

        return response;
    }

    /**
     * Logs a failed callout to a custom object for monitoring and replay.
     */
    public static void logFailedCallout(String endpoint, String method, String body,
            Integer statusCode, String errorMessage) {
        Integration_Log__c log = new Integration_Log__c(
            Endpoint__c = endpoint,
            Method__c = method,
            Request_Body__c = body != null ? body.left(131072) : null, // Long text area limit
            Status_Code__c = statusCode,
            Error_Message__c = errorMessage,
            Timestamp__c = Datetime.now(),
            Status__c = 'Failed'
        );
        insert log;
    }
}
```

## Queueable for Async Callouts

```apex
public class PaymentGatewayQueueable implements Queueable, Database.AllowsCallouts {

    private final Id opportunityId;
    private final String paymentMethodId;
    private final Decimal amount;
    private final String currency_x;

    public PaymentGatewayQueueable(Id opportunityId, String paymentMethodId,
            Decimal amount, String currency_x) {
        this.opportunityId = opportunityId;
        this.paymentMethodId = paymentMethodId;
        this.amount = amount;
        this.currency_x = currency_x;
    }

    public void execute(QueueableContext context) {
        try {
            PaymentGatewayService.PaymentResult result =
                PaymentGatewayService.chargePayment(paymentMethodId, amount, currency_x);

            Opportunity opp = new Opportunity(Id = opportunityId);
            if (result.success) {
                opp.Payment_Status__c = 'Charged';
                opp.Payment_Reference__c = result.chargeId;
            } else {
                opp.Payment_Status__c = 'Failed';
                opp.Payment_Error__c = result.errorMessage;

                CalloutRetryHelper.logFailedCallout(
                    'Payment_Gateway/charges', 'POST',
                    JSON.serialize(new Map<String, Object>{
                        'payment_method' => paymentMethodId,
                        'amount' => amount
                    }),
                    result.statusCode, result.errorMessage
                );
            }
            update opp;
        } catch (Exception e) {
            CalloutRetryHelper.logFailedCallout(
                'Payment_Gateway/charges', 'POST', null, null, e.getMessage()
            );
        }
    }
}
```

## Mock for Testing (HttpCalloutMock)

```apex
@IsTest
public class PaymentGatewayMock implements HttpCalloutMock {

    private final Integer statusCode;
    private final String responseBody;

    public PaymentGatewayMock(Integer statusCode, String responseBody) {
        this.statusCode = statusCode;
        this.responseBody = responseBody;
    }

    public HttpResponse respond(HttpRequest request) {
        HttpResponse response = new HttpResponse();
        response.setStatusCode(statusCode);
        response.setBody(responseBody);
        response.setHeader('Content-Type', 'application/json');
        return response;
    }

    // Convenience factory methods for common scenarios
    public static PaymentGatewayMock success() {
        return new PaymentGatewayMock(200, JSON.serialize(new Map<String, Object>{
            'id' => 'ch_test_123456',
            'status' => 'succeeded',
            'amount' => 5000,
            'currency' => 'usd'
        }));
    }

    public static PaymentGatewayMock failure() {
        return new PaymentGatewayMock(402, JSON.serialize(new Map<String, Object>{
            'error' => new Map<String, Object>{
                'type' => 'card_error',
                'message' => 'Your card was declined'
            }
        }));
    }

    public static PaymentGatewayMock serverError() {
        return new PaymentGatewayMock(500, '{"error": "Internal server error"}');
    }
}
```

## Test Class

```apex
@IsTest
private class PaymentGatewayService_Test {

    @IsTest
    static void testChargePayment_Success() {
        Test.setMock(HttpCalloutMock.class, PaymentGatewayMock.success());

        Test.startTest();
        PaymentGatewayService.PaymentResult result =
            PaymentGatewayService.chargePayment('pm_test_123', 50.00, 'usd');
        Test.stopTest();

        System.assertEquals(true, result.success);
        System.assertEquals('ch_test_123456', result.chargeId);
        System.assertEquals('succeeded', result.status);
    }

    @IsTest
    static void testChargePayment_Failure() {
        Test.setMock(HttpCalloutMock.class, PaymentGatewayMock.failure());

        Test.startTest();
        PaymentGatewayService.PaymentResult result =
            PaymentGatewayService.chargePayment('pm_test_123', 50.00, 'usd');
        Test.stopTest();

        System.assertEquals(false, result.success);
        System.assertEquals(402, result.statusCode);
        System.assert(result.errorMessage.contains('402'));
    }

    @IsTest
    static void testGetChargeStatus() {
        Test.setMock(HttpCalloutMock.class, PaymentGatewayMock.success());

        Test.startTest();
        PaymentGatewayService.PaymentResult result =
            PaymentGatewayService.getChargeStatus('ch_test_123456');
        Test.stopTest();

        System.assertEquals(true, result.success);
    }

    @IsTest
    static void testQueueableCallout_Success() {
        Opportunity opp = new Opportunity(
            Name = 'Test Opp',
            StageName = 'Closed Won',
            CloseDate = Date.today()
        );
        insert opp;

        Test.setMock(HttpCalloutMock.class, PaymentGatewayMock.success());

        Test.startTest();
        System.enqueueJob(
            new PaymentGatewayQueueable(opp.Id, 'pm_test_123', 100.00, 'usd')
        );
        Test.stopTest();

        Opportunity updated = [SELECT Payment_Status__c, Payment_Reference__c FROM Opportunity WHERE Id = :opp.Id];
        System.assertEquals('Charged', updated.Payment_Status__c);
        System.assertEquals('ch_test_123456', updated.Payment_Reference__c);
    }

    @IsTest
    static void testRetryHelper_RetryableStatusCode() {
        Test.setMock(HttpCalloutMock.class, PaymentGatewayMock.serverError());

        HttpRequest req = new HttpRequest();
        req.setEndpoint('callout:Payment_Gateway/charges');
        req.setMethod('POST');
        req.setBody('{}');

        Test.startTest();
        HttpResponse response = CalloutRetryHelper.sendWithRetry(req);
        Test.stopTest();

        // In test context, all retries return the same mock
        System.assertEquals(500, response.getStatusCode());
    }
}
```

## Key Principles

- Always use Named Credentials for external endpoints; never hardcode URLs or credentials in Apex
- Route all HTTP requests through a single method for consistent headers, timeouts, and logging
- Use idempotency keys for POST/PUT requests to prevent duplicate charges on retries
- Implement callouts in `Queueable` (with `Database.AllowsCallouts`) to avoid governor limits in triggers
- Create reusable `HttpCalloutMock` implementations with factory methods for common scenarios
- Log failed callouts to a custom object for monitoring, alerting, and manual replay

## Common Pitfalls

- Hardcoding API keys or endpoints instead of using Named Credentials (security risk and deployment headache)
- Making callouts in trigger context without wrapping in a `Queueable` or `@future` method
- Not setting `Test.setMock` before making callouts in tests, which causes "uncommitted work pending" errors
- Forgetting `Database.AllowsCallouts` on the `Queueable` class, which throws a runtime exception
- Not handling non-JSON error responses (some APIs return HTML on 500 errors)
- Exceeding the 100-callout-per-transaction limit in batch jobs without tracking callout count

## SCC Skills

- `/sf-security` -- verify Named Credential usage and no hardcoded secrets
- `/sf-apex-best-practices` -- review callout service code for best practices
- `/sf-tdd-workflow` -- write tests first using mock classes
- `/sf-governor-limits` -- check callout limits in async and batch contexts
