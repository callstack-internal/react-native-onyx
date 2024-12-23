// lib/OnyxSchema.ts
type SchemaType = 'string' | 'number' | 'boolean' | 'object' | 'array';

interface SchemaDefinition {
    type: SchemaType;
    required?: boolean;
    properties?: Record<string, SchemaDefinition>;
    items?: SchemaDefinition;
    pattern?: RegExp;
}

type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

interface SchemaOptions<T extends Record<string, SchemaDefinition>> {
    schema: DeepPartial<T>;
    onSchemaError?: (key: string, value: unknown, error: string) => void;
}

class SchemaValidator<T extends Record<string, SchemaDefinition>> {
    private schema: DeepPartial<T>;

    private onSchemaError: SchemaOptions<T>['onSchemaError'];

    constructor({schema, onSchemaError}: SchemaOptions<T>) {
        this.schema = schema;
        this.onSchemaError = onSchemaError;
    }

    hasKey(key: string): boolean {
        return !!(this.schema[key] || Object.entries(this.schema).some(([_, def]) => def?.pattern && def.pattern.test(key)));
    }

    validate<K extends keyof T>(key: K | string, value: unknown, schemaOverride?: SchemaDefinition): {isValid: boolean; error?: string} {
        let schemaForKey = schemaOverride || this.schema[key];

        if (!schemaForKey) {
            const patternMatch = Object.entries(this.schema).find(([_, def]) => def?.pattern && def.pattern.test(key));
            if (patternMatch) {
                schemaForKey = patternMatch[1];
            }
        }

        // If no schema found, return valid
        if (!schemaForKey || !schemaForKey.type) {
            return {isValid: true} as {isValid: boolean; error?: string};
        }

        const result = this.validateAgainstSchema(value, schemaForKey, key as string);
        if (!result.isValid && this.onSchemaError) {
            this.onSchemaError(key as string, value, result.error!);
        }
        return result;
    }

    private validateAgainstSchema(value: unknown, schema: DeepPartial<SchemaDefinition>, path: string): {isValid: boolean; error?: string} {
        if (value === null) {
            return {isValid: true};
        }

        if (schema.required && value === undefined) {
            return {isValid: false, error: `${path} is required`};
        }

        if (value === undefined) {
            return {isValid: true};
        }

        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== schema.type) {
            return {isValid: false, error: `${path} expected ${schema.type}, got ${actualType}`};
        }

        if (schema.type === 'object' && schema.properties) {
            const valueAsObject = value as Record<string, unknown>;

            // Check for unknown properties, but allow if '*' is defined
            const wildcardSchema = schema.properties['*'];
            const unknownProps = Object.keys(valueAsObject).filter((key) => !schema.properties![key] && key !== '*');

            if (unknownProps.length > 0 && !wildcardSchema) {
                return {isValid: false, error: `${path} contains unknown properties: ${unknownProps.join(', ')}`};
            }

            // Validate known properties
            const invalidResult = Object.entries(schema.properties).find(([propKey, propSchema]) => {
                if (propKey === '*') return false; // Skip wildcard in normal validation
                const result = this.validateAgainstSchema(valueAsObject[propKey], propSchema, `${path}.${propKey}`);
                return !result.isValid;
            });
            if (invalidResult) {
                return this.validateAgainstSchema(valueAsObject[invalidResult[0]], invalidResult[1], `${path}.${invalidResult[0]}`);
            }

            // Validate unknown properties against wildcard schema if it exists
            if (wildcardSchema && unknownProps.length > 0) {
                const invalidWildcard = unknownProps.find((prop) => {
                    const result = this.validateAgainstSchema(valueAsObject[prop], wildcardSchema, `${path}.${prop}`);
                    return !result.isValid;
                });
                if (invalidWildcard) {
                    return this.validateAgainstSchema(valueAsObject[invalidWildcard], wildcardSchema, `${path}.${invalidWildcard}`);
                }
            }
        }

        if (schema.type === 'array' && schema.items) {
            const valueAsArray = value as unknown[];
            const invalidItem = valueAsArray.find((item, i) => {
                const result = this.validateAgainstSchema(item, schema.items!, `${path}[${i}]`);
                return !result.isValid;
            });
            if (invalidItem !== undefined) {
                const index = valueAsArray.indexOf(invalidItem);
                return this.validateAgainstSchema(invalidItem, schema.items, `${path}[${index}]`);
            }
        }

        return {isValid: true};
    }
}

export type {SchemaDefinition, SchemaOptions};
export {SchemaValidator};
