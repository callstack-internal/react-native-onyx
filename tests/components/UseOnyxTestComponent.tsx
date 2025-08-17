import type {DependencyList, PropsWithChildren} from 'react';
import type {OnyxKey, OnyxValue, UseOnyxOptions, UseOnyxResult} from '../../lib';
import {useOnyx} from '../../lib';

type UseOnyxHook<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>> = {
    key: TKey;
    options?: UseOnyxOptions<TKey, TReturnValue>;
    dependencies?: DependencyList;
};

type UseOnyxOnRenderFn = (hookResults: Array<UseOnyxResult<OnyxValue<OnyxKey>>>) => void;

type UseOnyxTestComponentProps = PropsWithChildren<{
    hooks: Array<UseOnyxHook<OnyxKey>>;
    onRender?: UseOnyxOnRenderFn;
}>;

function UseOnyxTestComponent({hooks, onRender, children}: UseOnyxTestComponentProps) {
    const hookResults: Array<UseOnyxResult<OnyxValue<OnyxKey>>> = [];

    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < hooks.length; i++) {
        const {key, options, dependencies} = hooks[i];
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const useOnyxResult = useOnyx(key, options, dependencies);
        hookResults.push(useOnyxResult);
    }

    onRender?.(hookResults);

    return children;
}

export default UseOnyxTestComponent;
export type {UseOnyxOnRenderFn};
