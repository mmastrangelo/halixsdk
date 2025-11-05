// Halix SDK License v1.0
// Copyright (c) 2025 halix.io LLC.
//
// This source code is licensed for use **only** within applications
// running on the Halix platform, in accordance with Halix SDK guidelines.
//
// Unauthorized use outside the Halix platform is prohibited.
// Full license terms available in the LICENSE file.

/**
 * @module @halix/action-sdk/content
 * @description Content resource management functions for the Halix Platform action SDK.
 */

import axios from 'axios';
import { from, Observable, lastValueFrom } from 'rxjs';
import { sandboxKey, serviceAddress, getAuthToken, userContext } from './sdk-general';

// ================================================================================
// INTERFACES
// ================================================================================

/**
 * ContentResource is an interface defining the properties of a content resource.
 */
export interface ContentResource {
    objKey?: string;
    isPublic: boolean;
    resourceType: string;
    tags: string[];
    organizationKey: string;
    sandboxKey: string;
    userKey: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    contentType?: string;
    name?: string | null;
    extension?: string | null;
    deserialize?: (data: any) => ContentResource;
}

// ================================================================================
// CONTENT RESOURCE FUNCTIONS
// ================================================================================

/**
 * getOrCreateResource retrieves an existing content resource by its key, or creates a new one
 * if the key is not provided. If a resource key is provided, it attempts to fetch the existing
 * resource from the server. If no key is provided, it creates a new resource with the specified
 * properties.
 * 
 * @param resourceKey - Optional key of the existing resource to retrieve
 * @param fileToUpload - Optional file or blob to upload
 * @param publicFlag - Whether the resource should be public
 * @param resourceType - The type of resource
 * @param tags - Array of tags for the resource
 * 
 * @returns Promise resolving to a ContentResource
 */
export async function getOrCreateResource(resourceKey: string | null, fileToUpload: File | Blob | null, publicFlag: boolean, resourceType: string, tags: string[]): Promise<ContentResource> {

    if (!userContext) {
        throw new Error("userContext is required but not available; check that the initialize function has been called");
    }

    if (resourceKey) {
        let url = `${serviceAddress}/sandboxes/${sandboxKey}/contentResource/${resourceKey}`;
        let authToken = await lastValueFrom(getAuthToken());

        console.log("Sending GET request to " + url + " with token " + authToken);

        let response = await axios.get(url, {
            headers: { "Authorization": `Bearer ${authToken}` },
        });

        let resource: ContentResource = response.data;
        if (fileToUpload) {
            resource.contentType = fileToUpload.type;

            // Null out the name and extension; the server will set these if they are blank
            resource.name = null;
            resource.extension = null;
        }
        return resource;
    }

    let newResource: ContentResource = {
        isPublic: publicFlag,
        resourceType: resourceType,
        tags: tags,
        organizationKey: userContext.orgKey,
        sandboxKey: sandboxKey,
        userKey: userContext.user.objKey
    };

    if (fileToUpload) {
        newResource.contentType = fileToUpload.type;

        // Null out the name and extension; the server will set these if they are blank
        newResource.name = null;
        newResource.extension = null;
    }
    
    return newResource;
}

/**
 * getOrCreateResourceAsObservable retrieves an existing content resource by its key, or creates a new one
 * if the key is not provided. If a resource key is provided, it attempts to fetch the existing
 * resource from the server. If no key is provided, it creates a new resource with the specified
 * properties.
 * 
 * @param resourceKey - Optional key of the existing resource to retrieve
 * @param fileToUpload - Optional file or blob to upload
 * @param publicFlag - Whether the resource should be public
 * @param resourceType - The type of resource
 * @param tags - Array of tags for the resource
 * 
 * @returns Observable resolving to a ContentResource
 */
export function getOrCreateResourceAsObservable(resourceKey: string | null, fileToUpload: File | Blob | null, publicFlag: boolean, resourceType: string, tags: string[]): Observable<ContentResource> {
    return from(getOrCreateResource(resourceKey, fileToUpload, publicFlag, resourceType, tags));
}

/**
 * saveResource saves a content resource to the server. The resource is saved with appropriate
 * ownership parameters based on the current context (solution builder vs regular organization view).
 * 
 * @param resource - The ContentResource to save
 * 
 * @returns Promise resolving to the saved ContentResource
 */
export async function saveResource(resource: ContentResource): Promise<ContentResource> {

    if (!userContext) {
        throw new Error("userContext is required but not available; check that the initialize function has been called");
    }

    let params: any = {};

    if (userContext.orgProxy.objType === "Solution") {
        // When in the solution builder view, content is owned by the solution. The solution key is the org proxy key in
        // the builder view.
        params.solutionKey = userContext.orgProxyKey;
    } else {
        params.organizationKey = userContext.orgKey;
        params.userKey = userContext.user.objKey;
    }

    let url = `${serviceAddress}/sandboxes/${sandboxKey}/contentResource`;
    let authToken = await lastValueFrom(getAuthToken());

    console.log("Sending POST request to " + url + " with token " + authToken);

    let response = await axios.post(url, JSON.stringify(resource), {
        headers: { "Authorization": `Bearer ${authToken}` },
        params: params,
    });

    return response.data;
}

/**
 * saveResourceAsObservable saves a content resource to the server. The resource is saved with appropriate
 * ownership parameters based on the current context (solution builder vs regular organization view).
 * 
 * @param resource - The ContentResource to save
 * 
 * @returns Observable resolving to the saved ContentResource
 */
export function saveResourceAsObservable(resource: ContentResource): Observable<ContentResource> {
    return from(saveResource(resource));
}

/**
 * sendFileContents uploads file contents to the server for a specific resource. The file is uploaded
 * via FormData with the appropriate scope and public flag settings.
 * 
 * @param resourceKey - The key of the resource to upload file contents for
 * @param fileToUpload - The file or blob to upload
 * @param publicFlag - Whether the file should be public
 * 
 * @returns Promise resolving to true if upload was successful
 */
export async function sendFileContents(resourceKey: string, fileToUpload: File | Blob, publicFlag: boolean): Promise<boolean> {

    if (!userContext) {
        throw new Error("userContext is required but not available; check that the initialize function has been called");
    }

    let url = `${serviceAddress}/filecontent/${sandboxKey}/${resourceKey}`;
    let authToken = await lastValueFrom(getAuthToken());

    console.log("Sending file upload request to " + url + " with token " + authToken);

    let formData = new FormData();
    formData.append("fileUpload", fileToUpload);
    formData.append("scopeKeyPath", userContext.orgProxyKey);
    formData.append("public", String(publicFlag));

    let response = await axios.post(url, formData, {
        headers: { 
            "Authorization": `Bearer ${authToken}`,
            "Content-Type": "multipart/form-data"
        },
    });

    return response.status === 204;
}

/**
 * sendFileContentsAsObservable uploads file contents to the server for a specific resource. The file is uploaded
 * via FormData with the appropriate scope and public flag settings.
 * 
 * @param resourceKey - The key of the resource to upload file contents for
 * @param fileToUpload - The file or blob to upload
 * @param publicFlag - Whether the file should be public
 * 
 * @returns Observable resolving to true if upload was successful
 */
export function sendFileContentsAsObservable(resourceKey: string, fileToUpload: File | Blob, publicFlag: boolean): Observable<boolean> {
    return from(sendFileContents(resourceKey, fileToUpload, publicFlag));
}

/**
 * createOrUpdateResource creates a new content resource or updates an existing one, then uploads
 * the file contents to that resource. If a resourceKey is provided, it updates the existing resource;
 * otherwise, it creates a new resource and uploads the file to the newly created resource.
 * 
 * @param resourceKey - Optional key of the existing resource to update; if not provided, a new resource is created
 * @param fileToUpload - The file or blob to upload
 * @param publicFlag - Whether the resource should be public
 * @param resourceType - The type of resource
 * @param tags - Array of tags for the resource
 * 
 * @returns Promise resolving to the ContentResource with uploaded file
 */
export async function createOrUpdateResource(resourceKey: string | null, fileToUpload: File | Blob, publicFlag: boolean, resourceType: string, tags: string[]): Promise<ContentResource> {

    if (!userContext) {
        throw new Error("userContext is required but not available; check that the initialize function has been called");
    }

    // Get or create the resource
    let resource = await getOrCreateResource(resourceKey, fileToUpload, publicFlag, resourceType, tags);
    
    // Save the resource to get the objKey if it's new
    let savedResource = await saveResource(resource);
    
    // Upload the file contents
    if (!savedResource.objKey) {
        throw new Error("Resource was saved but no objKey was returned");
    }
    
    let uploadSuccess = await sendFileContents(savedResource.objKey, fileToUpload, publicFlag);
    
    if (!uploadSuccess) {
        throw new Error("Failed to upload file contents");
    }
    
    // Get the updated resource with file metadata
    let updatedResource = await getOrCreateResource(savedResource.objKey, fileToUpload, publicFlag, resourceType, []);
    
    // Set the name if it's not set and we have a File with a name
    if (updatedResource && !updatedResource.name && fileToUpload instanceof File) {
        updatedResource.name = fileToUpload.name;
    }
    
    return updatedResource;
}

/**
 * createOrUpdateResourceAsObservable creates a new content resource or updates an existing one, then uploads
 * the file contents to that resource. If a resourceKey is provided, it updates the existing resource;
 * otherwise, it creates a new resource and uploads the file to the newly created resource.
 * 
 * @param resourceKey - Optional key of the existing resource to update; if not provided, a new resource is created
 * @param fileToUpload - The file or blob to upload
 * @param publicFlag - Whether the resource should be public
 * @param resourceType - The type of resource
 * @param tags - Array of tags for the resource
 * 
 * @returns Observable resolving to the ContentResource with uploaded file
 */
export function createOrUpdateResourceAsObservable(resourceKey: string | null, fileToUpload: File | Blob, publicFlag: boolean, resourceType: string, tags: string[]): Observable<ContentResource> {
    return from(createOrUpdateResource(resourceKey, fileToUpload, publicFlag, resourceType, tags));
}

