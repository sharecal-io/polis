import type { Directory, DirectorySyncRequest } from '../../../src/typings';

const requests = {
  create: (directory: Directory, user: any): DirectorySyncRequest => {
    return {
      method: 'POST',
      body: user,
      directoryId: directory.id,
      resourceType: 'users',
      resourceId: undefined,
      apiSecret: directory.scim.secret,
      query: {},
    };
  },

  // GET /Users?filter=userName eq "userName"
  filterByUsername: (directory: Directory, userName: string): DirectorySyncRequest => {
    return {
      method: 'GET',
      body: undefined,
      directoryId: directory.id,
      resourceType: 'users',
      resourceId: undefined,
      apiSecret: directory.scim.secret,
      query: {
        filter: `userName eq "${userName}"`,
        count: 1,
        startIndex: 1,
      },
    };
  },

  // GET /Users/{userId}
  getById: (directory: Directory, userId: string): DirectorySyncRequest => {
    return {
      method: 'GET',
      body: undefined,
      directoryId: directory.id,
      resourceType: 'users',
      resourceId: userId,
      apiSecret: directory.scim.secret,
      query: {},
    };
  },

  // PUT /Users/{userId}
  updateById: (directory: Directory, userId: string, user: any): DirectorySyncRequest => {
    return {
      method: 'PUT',
      body: user,
      directoryId: directory.id,
      resourceType: 'users',
      resourceId: userId,
      apiSecret: directory.scim.secret,
      query: {},
    };
  },

  // PATCH /Users/{userId}
  updateOperationById: (directory: Directory, userId: string): DirectorySyncRequest => {
    return {
      method: 'PATCH',
      body: {
        Operations: [
          {
            op: 'replace',
            value: {
              active: false,
            },
          },
        ],
      },
      directoryId: directory.id,
      resourceType: 'users',
      resourceId: userId,
      apiSecret: directory.scim.secret,
      query: {},
    };
  },

  // PATCH /Users/{userId} - rename userName
  patchUserName: (directory: Directory, userId: string, userName: string): DirectorySyncRequest => {
    return {
      method: 'PATCH',
      body: {
        Operations: [
          {
            op: 'replace',
            path: 'userName',
            value: userName,
          },
        ],
      },
      directoryId: directory.id,
      resourceType: 'users',
      resourceId: userId,
      apiSecret: directory.scim.secret,
      query: {},
    };
  },

  // GET /Users/
  getAll: (directory: Directory): DirectorySyncRequest => {
    return {
      method: 'GET',
      body: undefined,
      directoryId: directory.id,
      resourceType: 'users',
      resourceId: undefined,
      apiSecret: directory.scim.secret,
      query: {
        count: 1,
        startIndex: 1,
      },
    };
  },

  // DELETE /Users/{userId}
  deleteById: (directory: Directory, userId: string): DirectorySyncRequest => {
    return {
      method: 'DELETE',
      body: undefined,
      directoryId: directory.id,
      resourceType: 'users',
      resourceId: userId,
      apiSecret: directory.scim.secret,
      query: {},
    };
  },

  // Multi-valued properties
  multiValuedProperties: (directory: Directory, userId: string): DirectorySyncRequest => {
    return {
      method: 'PATCH',
      body: {
        Operations: [
          {
            op: 'replace',
            path: 'name.givenName',
            value: 'David',
          },
          {
            op: 'replace',
            path: 'name.familyName',
            value: 'Jones',
          },
          {
            op: 'replace',
            value: { active: false },
          },
        ],
      },
      directoryId: directory.id,
      resourceType: 'users',
      resourceId: userId,
      apiSecret: directory.scim.secret,
      query: {},
    };
  },

  // Custom attributes
  customAttributes: (directory: Directory, userId: string): DirectorySyncRequest => {
    return {
      method: 'PATCH',
      body: {
        Operations: [
          {
            op: 'replace',
            path: 'companyName',
            value: 'Ory',
          },
          {
            op: 'add',
            path: 'address.streetAddress',
            value: '123 Main St',
          },
        ],
      },
      directoryId: directory.id,
      resourceType: 'users',
      resourceId: userId,
      apiSecret: directory.scim.secret,
      query: {},
    };
  },

  // Entra ID-style PATCH with SCIM filter paths for phone numbers and addresses
  entraPhoneAndAddress: (directory: Directory, userId: string): DirectorySyncRequest => {
    return {
      method: 'PATCH',
      body: {
        Operations: [
          {
            op: 'replace',
            path: 'phoneNumbers[type eq "work"].value',
            value: '555-0100',
          },
          {
            op: 'replace',
            path: 'phoneNumbers[type eq "mobile"].value',
            value: '555-0101',
          },
          {
            op: 'replace',
            path: 'addresses[type eq "work"].streetAddress',
            value: '100 Enterprise Blvd',
          },
          {
            op: 'replace',
            path: 'addresses[type eq "work"].locality',
            value: 'San Francisco',
          },
          {
            op: 'replace',
            path: 'addresses[type eq "work"].postalCode',
            value: '94105',
          },
          {
            op: 'replace',
            path: 'addresses[type eq "work"].country',
            value: 'US',
          },
        ],
      },
      directoryId: directory.id,
      resourceType: 'users',
      resourceId: userId,
      apiSecret: directory.scim.secret,
      query: {},
    };
  },

  // Entra: clear filter-path attributes by setting to empty string
  entraClearFilterPathAttributes: (directory: Directory, userId: string): DirectorySyncRequest => {
    return {
      method: 'PATCH',
      body: {
        Operations: [
          {
            op: 'replace',
            path: 'phoneNumbers[type eq "work"].value',
            value: '',
          },
          {
            op: 'replace',
            path: 'addresses[type eq "work"].streetAddress',
            value: '',
          },
        ],
      },
      directoryId: directory.id,
      resourceType: 'users',
      resourceId: userId,
      apiSecret: directory.scim.secret,
      query: {},
    };
  },

  // Remove custom attributes using op: "remove" (Entra may use this to clear fields)
  removeCustomAttributes: (directory: Directory, userId: string): DirectorySyncRequest => {
    return {
      method: 'PATCH',
      body: {
        Operations: [
          {
            op: 'remove',
            path: 'companyName',
          },
          {
            op: 'remove',
            path: 'address.streetAddress',
          },
        ],
      },
      directoryId: directory.id,
      resourceType: 'users',
      resourceId: userId,
      apiSecret: directory.scim.secret,
      query: {},
    };
  },

  // Remove standard mapped attributes using op: "remove" (name.givenName, name.familyName)
  removeStandardMappedAttributes: (directory: Directory, userId: string): DirectorySyncRequest => {
    return {
      method: 'PATCH',
      body: {
        Operations: [
          {
            op: 'remove',
            path: 'name.givenName',
          },
          {
            op: 'remove',
            path: 'name.familyName',
          },
        ],
      },
      directoryId: directory.id,
      resourceType: 'users',
      resourceId: userId,
      apiSecret: directory.scim.secret,
      query: {},
    };
  },

  // Remove standard attribute using op: "remove" with no value
  removeTitle: (directory: Directory, userId: string): DirectorySyncRequest => {
    return {
      method: 'PATCH',
      body: {
        Operations: [
          {
            op: 'remove',
            path: 'title',
          },
        ],
      },
      directoryId: directory.id,
      resourceType: 'users',
      resourceId: userId,
      apiSecret: directory.scim.secret,
      query: {},
    };
  },

  // Entra enterprise extension: set a custom field via the extension schema (no-path format)
  entraSetExtensionAttribute: (directory: Directory, userId: string): DirectorySyncRequest => {
    return {
      method: 'PATCH',
      body: {
        Operations: [
          {
            op: 'replace',
            value: {
              'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User': {
                department: 'Engineering',
                costCenter: 'CC-1234',
              },
            },
          },
        ],
      },
      directoryId: directory.id,
      resourceType: 'users',
      resourceId: userId,
      apiSecret: directory.scim.secret,
      query: {},
    };
  },

  // Entra enterprise extension: clear a custom field via the extension schema (no-path format)
  entraClearExtensionAttribute: (directory: Directory, userId: string): DirectorySyncRequest => {
    return {
      method: 'PATCH',
      body: {
        Operations: [
          {
            op: 'replace',
            value: {
              'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User': {
                department: '',
                costCenter: '',
              },
            },
          },
        ],
      },
      directoryId: directory.id,
      resourceType: 'users',
      resourceId: userId,
      apiSecret: directory.scim.secret,
      query: {},
    };
  },

  // Entra enterprise extension: set then clear via path-based format
  entraSetExtensionViaPath: (directory: Directory, userId: string, value: string): DirectorySyncRequest => {
    return {
      method: 'PATCH',
      body: {
        Operations: [
          {
            op: 'replace',
            path: 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:department',
            value,
          },
        ],
      },
      directoryId: directory.id,
      resourceType: 'users',
      resourceId: userId,
      apiSecret: directory.scim.secret,
      query: {},
    };
  },

  // Entra: clear multi-valued attribute by replacing with empty array
  entraClearMultiValuedAttribute: (directory: Directory, userId: string): DirectorySyncRequest => {
    return {
      method: 'PATCH',
      body: {
        Operations: [
          {
            op: 'replace',
            path: 'phoneNumbers',
            value: [],
          },
        ],
      },
      directoryId: directory.id,
      resourceType: 'users',
      resourceId: userId,
      apiSecret: directory.scim.secret,
      query: {},
    };
  },

  // Clear custom attributes by setting them to empty string (Entra clears fields this way)
  clearCustomAttributes: (directory: Directory, userId: string): DirectorySyncRequest => {
    return {
      method: 'PATCH',
      body: {
        Operations: [
          {
            op: 'replace',
            path: 'companyName',
            value: '',
          },
          {
            op: 'replace',
            path: 'address.streetAddress',
            value: '',
          },
        ],
      },
      directoryId: directory.id,
      resourceType: 'users',
      resourceId: userId,
      apiSecret: directory.scim.secret,
      query: {},
    };
  },

  // Clear custom attributes via object value (no path, Entra alternate format)
  clearCustomAttributesViaObject: (directory: Directory, userId: string): DirectorySyncRequest => {
    return {
      method: 'PATCH',
      body: {
        Operations: [
          {
            op: 'replace',
            value: {
              title: '',
              displayName: '',
            },
          },
        ],
      },
      directoryId: directory.id,
      resourceType: 'users',
      resourceId: userId,
      apiSecret: directory.scim.secret,
      query: {},
    };
  },

  // PUT request that omits a previously-set custom field (full replacement)
  updateByIdWithoutCustomField: (directory: Directory, userId: string, user: any): DirectorySyncRequest => {
    return {
      method: 'PUT',
      body: user,
      directoryId: directory.id,
      resourceType: 'users',
      resourceId: userId,
      apiSecret: directory.scim.secret,
      query: {},
    };
  },

  // Entra: set extension multi-valued attribute via URN path
  entraSetExtensionMultiValued: (directory: Directory, userId: string): DirectorySyncRequest => {
    return {
      method: 'PATCH',
      body: {
        Operations: [
          {
            op: 'replace',
            value: {
              'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User': {
                roles: [
                  { value: 'admin-role-id', display: 'Admin' },
                  { value: 'user-role-id', display: 'User' },
                ],
              },
            },
          },
        ],
      },
      directoryId: directory.id,
      resourceType: 'users',
      resourceId: userId,
      apiSecret: directory.scim.secret,
      query: {},
    };
  },

  // Entra: remove a specific value from extension multi-valued attribute via URN + filter path
  entraRemoveExtensionFilterPath: (directory: Directory, userId: string): DirectorySyncRequest => {
    return {
      method: 'PATCH',
      body: {
        Operations: [
          {
            op: 'remove',
            path: 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:roles[value eq "admin-role-id"]',
          },
        ],
      },
      directoryId: directory.id,
      resourceType: 'users',
      resourceId: userId,
      apiSecret: directory.scim.secret,
      query: {},
    };
  },

  // Arbitrary attribute names with SCIM filter paths (e.g. ims, photos)
  arbitraryFilterPaths: (directory: Directory, userId: string): DirectorySyncRequest => {
    return {
      method: 'PATCH',
      body: {
        Operations: [
          {
            op: 'replace',
            path: 'ims[type eq "xmpp"].value',
            value: 'test@test.org',
          },
          {
            op: 'replace',
            path: 'photos[type eq "thumbnail"].value',
            value: 'https://example.com/photo.jpg',
          },
        ],
      },
      directoryId: directory.id,
      resourceType: 'users',
      resourceId: userId,
      apiSecret: directory.scim.secret,
      query: {},
    };
  },
};

export default requests;
