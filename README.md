# Halix Action SDK

The **Halix Action SDK** (`@halix/action-sdk`) provides a development framework for creating NodeJS Lambda-based actions that run inside the [Halix Platform](https://halix.io). It offers a streamlined API for handling incoming events, interacting with Halix data services, and sending structured responses back to the platform.

> 📌 **Note:** This SDK is **source-available** and is **licensed for use only within applications running on the Halix platform.**  
> See the [LICENSE](./LICENSE) file for full terms.

---
## 📦 Installation

No installation is required.

The `@halix/action-sdk` is **natively available in the Halix platform runtime** and does not need to be manually installed or included via NPM.

Import the SDK using ECMAScript module syntax:

```js
import * as hx from '@halix/action-sdk';
```

This makes all SDK utilities available under the `hx.` namespace for clean and consistent access throughout your action logic.

---

## 🚀 Getting Started

Here’s a minimal example of a Halix action written in Node.js with ES module syntax:

```js
import * as hx from '@halix/action-sdk';

export const handler = async (event) => {
  // Initialize the SDK with incoming event context
  hx.initialize(event);

  // Get the subject of the action
  const obj = hx.actionSubject;

  // Refresh the object from the server
  let fullObj;
  try {
    fullObj = await hx.getObject('exampleType', obj.objKey);
  } catch (err) {
    console.error('Error fetching object', err);
    return hx.prepareErrorResponse('Failed to retrieve data');
  }

  // Perform updates or logic
  fullObj.status = 'Updated';

  // Save the updated object
  let saved;
  try {
    saved = await hx.saveRelatedObject('parentType', fullObj.parentKey, 'exampleType', fullObj);
  } catch (err) {
    console.error('Error saving object', err);
    return hx.prepareErrorResponse('Failed to save data');
  }

  // Return a success response
  return hx.prepareSuccessResponse({
    responseType: 'formTemplateAction',
    updatedSubject: saved,
    successMessage: 'Object saved successfully',
    isError: false
  });
};
```

This action pattern is typical for use in Halix’s Lambda-style runtime environment.

---

## 📘 Key Concepts

- `authToken`: Auth token for secure API calls
- `sandboxKey`: Identifies the current Halix solution environment
- `actionSubject`: Object being acted on (varies by context)
- `userContext`: Info about the executing user
- `params`: Inputs passed to the action

---

## 🛠️ Core Functions

| Function | Description |
|----------|-------------|
| `initialize(event)` | Initializes the SDK with event context |
| `invokeAction(...)` / `invokeActionAsObservable(...)` | Invoke a browser-enabled server Action once |
| `getObject(...)` / `getObjectAsObservable(...)` | Retrieve a single object |
| `getRelatedObjects(...)` / `getRelatedObjectsAsObservable(...)` | Retrieve related objects |
| `saveRelatedObject(...)` / `saveRelatedObjectAsObservable(...)` | Save objects and relationships |
| `deleteRelatedObject(...)` / `deleteRelatedObjectAsObservable(...)` | Delete a single related object |
| `deleteRelatedObjects(...)` / `deleteRelatedObjectsAsObservable(...)` | Delete multiple related objects (uses `keys` query param) |
| `submitStandalonePayment(...)` / `submitStandalonePaymentAsObservable(...)` | Finalize a payment from a gateway preauth result |
| `prepareSuccessResponse(...)` | Create a success response |
| `prepareErrorResponse(...)` | Create an error response |

Notes:
- Functions that interact with services require `initialize(event)` to have been called; they depend on `userContext`, `sandboxKey`, and `serviceAddress`.

---

## Server Action Invocation

Browser components can invoke a server Action by key or ID through the authenticated canonical route:

```ts
const result = await hx.invokeAction<{ duplicateCount: number }>(
  'mark-duplicates',
  {
    params: { contactKey },
  },
);

console.log(result.value?.duplicateCount);
```

`orgProxyKey` and `userProxyKey` default from the initialized `userContext`. They are only hints: the server validates them against the current same-origin session and sandbox before selecting an organization Action or settings override.

Invocations are synchronous and are never automatically retried. The default and maximum browser timeout is 55 seconds, matching the verified ingress bound. An Action can perform non-idempotent work, so callers decide whether a retry is safe.

When starting work without awaiting it immediately, always attach rejection handling:

```ts
void hx.invokeAction('refresh-dashboard', {
  params: { dashboardKey },
}).catch((error) => {
  console.error('Dashboard refresh failed', error);
});
```

`ActionInvocationError` covers HTTP failures, Lambda function failures, `responseType: "error"`, and any response with `isError: true`.

---

## 📦 Content Resource Helpers

These helpers simplify working with content resources and file uploads.

| Function | Description |
|----------|-------------|
| `getOrCreateResource(...)` / `getOrCreateResourceAsObservable(...)` | Retrieve an existing content resource by key or create a new one |
| `saveResource(...)` / `saveResourceAsObservable(...)` | Persist a content resource |
| `sendFileContents(resourceKey, file, publicFlag)` / `sendFileContentsAsObservable(...)` | Upload file contents (multipart/form-data) to a content resource |
| `createOrUpdateResource(resourceKey?, file, publicFlag, resourceType, tags)` / `createOrUpdateResourceAsObservable(...)` | Create or update a resource and upload the file in one call |

---

## Payment Helpers

Use `submitStandalonePayment(...)` after UI code has already produced a gateway preauth result and you need action code to finish the payment through the platform backend.

```js
const result = await hx.submitStandalonePayment({
  payerKey: hx.userContext.userProxyKey,
  payeeKey: hx.userContext.orgKey,
  paymentAmount: 49.99,
  preAuthResult,
  hostObjectKey: invoice.objKey,
  hostElementId: 'clientInvoice',
  hostAttributeId: 'paymentStatus',
  generateTransaction: true,
  chargeDescription: 'Invoice payment'
});

console.log(result.paymentKey, result.paymentSummary);
```

Notes:
- `organizationKey` is taken from `userContext.orgKey`, and `payerType` is fixed to `SolutionUserProxy`.
- The SDK assumes a Stripe preauth result and injects `paymentGateway: 'stripe'` before sending the request.
- Extra fields on `preAuthResult` are still passed through because Stripe completion may require gateway-specific values such as token or saved-payment-method identifiers.
- `hostObjectKey`, `hostElementId`, and `hostAttributeId` must point at a real solution-defined object field that the backend can update with the returned payment summary.
- `bankAccountPayment` is optional in the SDK wrapper; if omitted it is inferred from common ACH payment method values in the preauth result.
- `payeeKey` should be the organization receiving the payment.

---

## 🧪 Utilities

| Function | Description |
|----------|-------------|
| `getValueFromObject(object, attribute)` | Access nested or relationship-based attributes |
| `debounceFn(fn, wait?)` | Debounce utility for throttling calls |
| `compareValues(a, b, descending, caseInsensitive)` | Utility comparer for sorting |
| `sortObjectArray(array, sort)` | Utility to sort object arrays |

---

## 🔐 License

**Halix SDK License v1.0**

This SDK is licensed for **use only within applications running on the Halix platform**, in accordance with Halix SDK guidelines.

- **You may not** use this SDK outside the Halix platform.
- Full license text is available in the [LICENSE](./LICENSE) file.

For commercial licensing outside this scope, contact [hello@halix.io](mailto:hello@halix.io).

---

## 🧰 Contributing

This repository is source-available but not open source. Contributions are currently limited to internal Halix developers and partners. Please open an issue to discuss improvements or bug reports.

---

## 🧭 About Halix

Halix is a low-code platform designed to empower developers and business users to build powerful applications quickly. Learn more at [halix.io](https://halix.io).
