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

export default function <TComponentProps, TOnyxProps>(
    mapOnyxToState: MapOnyxToState<TComponentProps, TOnyxProps>,
): (component: React.ComponentType<TComponentProps>) => React.ComponentType<Omit<TComponentProps, keyof TOnyxProps>> {
    return (WrappedComponent: React.ComponentType<TComponentProps>): React.ComponentType<Omit<TComponentProps, keyof TOnyxProps>> => {
        const displayName = getDisplayName(WrappedComponent);

        function WithOnyx(props: WithOnyxProps<TComponentProps, TOnyxProps>) {
            const onyxDataToPass: Partial<TOnyxProps> = {};

            const mappings = mapOnyxToStateEntries(mapOnyxToState);

            let useOnyxHooksInLoadingState = 0;
            const areAllUseOnyxHooksLoadedRef = useRef(false);

            // eslint-disable-next-line @typescript-eslint/prefer-for-of
            for (let i = 0; i < mappings.length; i++) {
                const [propName, mapping] = mappings[i];
                const canEvict = mapping.canEvict !== undefined ? !!Str.result(mapping.canEvict as GenericFunction, props) : undefined;
                const key = Str.result(mapping.key as GenericFunction, props);

                // eslint-disable-next-line no-undef-init
                let selector: UseOnyxSelector<OnyxKey, OnyxValue<OnyxKey>> | undefined = undefined;
                if ('selector' in mapping) {
                    if (OnyxUtils.isCollectionKey(key)) {
                        selector = (data) => OnyxUtils.reduceCollectionWithSelector(data as OnyxCollection<unknown>, mapping.selector, undefined);
                    } else {
                        selector = mapping.selector;
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

                onyxDataToPass[propName] = useOnyxHookData as TOnyxProps[keyof TOnyxProps];
            }

            if (!areAllUseOnyxHooksLoadedRef.current && useOnyxHooksInLoadingState > 0) {
                return null;
            }

            if (!areAllUseOnyxHooksLoadedRef.current) {
                areAllUseOnyxHooksLoadedRef.current = true;
            }

            // Spreading props and state is necessary in an HOC where the data cannot be predicted
            return (
                <WrappedComponent
                    // eslint-disable-next-line react/jsx-props-no-spreading
                    {...(props as TComponentProps)}
                    // eslint-disable-next-line react/jsx-props-no-spreading
                    {...onyxDataToPass}
                    ref={props.forwardedRef}
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
