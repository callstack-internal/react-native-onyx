import React, {useRef} from 'react';
import OnyxUtils from './OnyxUtils';
import * as Str from './Str';
import type {GenericFunction, OnyxCollection, OnyxKey, OnyxValue} from './types';
import type {UseOnyxSelector} from './useOnyx';
import useOnyx from './useOnyx';
import type {MapOnyxToState, WithOnyxMapping, WithOnyxProps} from './withOnyx/types';

/**
 * Returns the display name of a component
 */
function getDisplayName<TComponentProps>(component: React.ComponentType<TComponentProps>): string {
    return component.displayName || component.name || 'Component';
}

/**
 * Utility function to return the properly typed entries of the `withOnyx` mapping object.
 */
function mapOnyxToStateEntries<TComponentProps, TOnyxProps>(mapOnyxToState: MapOnyxToState<TComponentProps, TOnyxProps>) {
    return Object.entries(mapOnyxToState) as Array<[keyof TOnyxProps, WithOnyxMapping<TComponentProps, TOnyxProps>]>;
}

/**
 * Represents the `withOnyx` internal component state.
 */
type WithOnyxState<TOnyxProps> = {
    areAllUseOnyxHooksLoaded: boolean;
    propsToPass: Partial<TOnyxProps>;
};

export default function <TComponentProps, TOnyxProps>(
    mapOnyxToState: MapOnyxToState<TComponentProps, TOnyxProps>,
): (component: React.ComponentType<TComponentProps>) => React.ComponentType<Omit<TComponentProps, keyof TOnyxProps>> {
    return (WrappedComponent: React.ComponentType<TComponentProps>): React.ComponentType<Omit<TComponentProps, keyof TOnyxProps>> => {
        const displayName = getDisplayName(WrappedComponent);

        function WithOnyx(componentProps: WithOnyxProps<TComponentProps, TOnyxProps>) {
            const {forwardedRef, ...rest} = componentProps;
            const props = rest as WithOnyxProps<TComponentProps, TOnyxProps>;

            const mappings = mapOnyxToStateEntries(mapOnyxToState);

            let useOnyxHooksInLoadingState = 0;
            const withOnyxStateRef = useRef<WithOnyxState<TOnyxProps>>({
                areAllUseOnyxHooksLoaded: false,
                propsToPass: {},
            });

            // eslint-disable-next-line @typescript-eslint/prefer-for-of
            for (let i = 0; i < mappings.length; i++) {
                const [propName, mapping] = mappings[i];
                const canEvict = mapping.canEvict !== undefined ? !!Str.result(mapping.canEvict as GenericFunction, {...props, ...withOnyxStateRef.current.propsToPass}) : undefined;
                const key = Str.result(mapping.key as GenericFunction, {...props, ...withOnyxStateRef.current.propsToPass});

                // eslint-disable-next-line no-undef-init
                let selector: UseOnyxSelector<OnyxKey, OnyxValue<OnyxKey>> | undefined = undefined;
                if ('selector' in mapping) {
                    if (OnyxUtils.isCollectionKey(key)) {
                        selector = (data) => {
                            return OnyxUtils.reduceCollectionWithSelector(data as OnyxCollection<unknown>, mapping.selector, {...props, ...withOnyxStateRef.current.propsToPass});
                        };
                    } else {
                        selector = (data) => {
                            return mapping.selector(data, withOnyxStateRef.current.areAllUseOnyxHooksLoaded ? {...props, ...withOnyxStateRef.current.propsToPass} : undefined);
                        };
                    }
                }

                // eslint-disable-next-line react-hooks/rules-of-hooks
                const [useOnyxHookData, useOnyxHookResult] = useOnyx(key, {
                    selector,
                    canEvict,
                    allowStaleData: mapping.allowStaleData,
                    initWithStoredValues: mapping.initWithStoredValues,
                    canBeMissing: true,
                });

                if (useOnyxHookResult.status === 'loading') {
                    useOnyxHooksInLoadingState++;
                }

                withOnyxStateRef.current.propsToPass[propName] = useOnyxHookData as TOnyxProps[keyof TOnyxProps];

                if (useOnyxHookData === undefined && props[propName as keyof WithOnyxProps<TComponentProps, TOnyxProps>] !== undefined) {
                    withOnyxStateRef.current.propsToPass[propName] = props[propName as keyof WithOnyxProps<TComponentProps, TOnyxProps>] as TOnyxProps[keyof TOnyxProps];
                }
            }

            if (!withOnyxStateRef.current.areAllUseOnyxHooksLoaded && useOnyxHooksInLoadingState === 0) {
                withOnyxStateRef.current.areAllUseOnyxHooksLoaded = true;
            }

            if (!withOnyxStateRef.current.areAllUseOnyxHooksLoaded) {
                return null;
            }

            // Spreading props and state is necessary in an HOC where the data cannot be predicted
            return (
                <WrappedComponent
                    // eslint-disable-next-line react/jsx-props-no-spreading
                    {...(props as TComponentProps)}
                    // eslint-disable-next-line react/jsx-props-no-spreading
                    {...withOnyxStateRef.current.propsToPass}
                    ref={forwardedRef}
                />
            );
        }

        WithOnyx.displayName = `withOnyx(${displayName})`;

        return React.forwardRef((props, ref) => {
            const Component = WithOnyx;
            return (
                <Component
                    // eslint-disable-next-line react/jsx-props-no-spreading
                    {...props}
                    forwardedRef={ref}
                />
            );
        });
    };
}
