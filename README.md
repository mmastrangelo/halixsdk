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
| `getObject(...)` / `getObjectAsObservable(...)` | Retrieve a single object |
| `getRelatedObjects(...)` / `getRelatedObjectsAsObservable(...)` | Retrieve related objects |
| `saveRelatedObject(...)` / `saveRelatedObjectAsObservable(...)` | Save objects and relationships |
| `deleteRelatedObject(...)` / `deleteRelatedObjectAsObservable(...)` | Delete a single related object |
| `deleteRelatedObjects(...)` / `deleteRelatedObjectsAsObservable(...)` | Delete multiple related objects (uses `keys` query param) |
| `prepareSuccessResponse(...)` | Create a success response |
| `prepareErrorResponse(...)` | Create an error response |

Notes:
- Functions that interact with services require `initialize(event)` to have been called; they depend on `userContext`, `sandboxKey`, and `serviceAddress`.

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
