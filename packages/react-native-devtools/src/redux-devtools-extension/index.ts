import { compose } from "redux";
import type { Action, ActionCreator, StoreEnhancer } from "redux";

export interface EnhancerOptions {
  /**
   * the instance name to be showed on the monitor page. Default value is `document.title`.
   * If not specified and there's no document title, it will consist of `tabId` and `instanceId`.
   */
  name?: string;
  /**
   * action creators functions to be available in the Dispatcher.
   */
  actionCreators?: ActionCreator<any>[] | { [key: string]: ActionCreator<any> };
  /**
   * if more than one action is dispatched in the indicated interval, all new actions will be collected and sent at once.
   * It is the joint between performance and speed. When set to `0`, all actions will be sent instantly.
   * Set it to a higher value when experiencing perf issues (also `maxAge` to a lower value).
   *
   * @default 500 ms.
   */
  latency?: number;
  /**
   * (> 1) - maximum allowed actions to be stored in the history tree. The oldest actions are removed once maxAge is reached. It's critical for performance.
   *
   * @default 50
   */
  maxAge?: number;
  /**
   * Customizes how actions and state are serialized and deserialized. Can be a boolean or object. If given a boolean, the behavior is the same as if you
   * were to pass an object and specify `options` as a boolean. Giving an object allows fine-grained customization using the `replacer` and `reviver`
   * functions.
   */
  serialize?:
    | boolean
    | {
        /**
         * - `undefined` - will use regular `JSON.stringify` to send data (it's the fast mode).
         * - `false` - will handle also circular references.
         * - `true` - will handle also date, regex, undefined, error objects, symbols, maps, sets and functions.
         * - object, which contains `date`, `regex`, `undefined`, `error`, `symbol`, `map`, `set` and `function` keys.
         *   For each of them you can indicate if to include (by setting as `true`).
         *   For `function` key you can also specify a custom function which handles serialization.
         *   See [`jsan`](https://github.com/kolodny/jsan) for more details.
         */
        options?:
          | undefined
          | boolean
          | {
              date?: true;
              regex?: true;
              undefined?: true;
              error?: true;
              symbol?: true;
              map?: true;
              set?: true;
              function?: true | ((fn: (...args: any[]) => any) => string);
            };
        /**
         * [JSON replacer function](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#The_replacer_parameter) used for both actions and states stringify.
         * In addition, you can specify a data type by adding a [`__serializedType__`](https://github.com/zalmoxisus/remotedev-serialize/blob/master/helpers/index.js#L4)
         * key. So you can deserialize it back while importing or persisting data.
         * Moreover, it will also [show a nice preview showing the provided custom type](https://cloud.githubusercontent.com/assets/7957859/21814330/a17d556a-d761-11e6-85ef-159dd12f36c5.png):
         */
        replacer?: (key: string, value: unknown) => any;
        /**
         * [JSON `reviver` function](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse#Using_the_reviver_parameter)
         * used for parsing the imported actions and states. See [`remotedev-serialize`](https://github.com/zalmoxisus/remotedev-serialize/blob/master/immutable/serialize.js#L8-L41)
         * as an example on how to serialize special data types and get them back.
         */
        reviver?: (key: string, value: unknown) => any;
        /**
         * Automatically serialize/deserialize immutablejs via [remotedev-serialize](https://github.com/zalmoxisus/remotedev-serialize).
         * Just pass the Immutable library. It will support all ImmutableJS structures. You can even export them into a file and get them back.
         * The only exception is `Record` class, for which you should pass this in addition the references to your classes in `refs`.
         */
        immutable?: unknown;
        /**
         * ImmutableJS `Record` classes used to make possible restore its instances back when importing, persisting...
         */
        refs?: (new (data: any) => unknown)[];
      };
  /**
   * function which takes `action` object and id number as arguments, and should return `action` object back.
   */
  actionSanitizer?: <A extends Action>(action: A, id: number) => A;
  /**
   * function which takes `state` object and index as arguments, and should return `state` object back.
   */
  stateSanitizer?: <S>(state: S, index: number) => S;
  /**
   * *string or array of strings as regex* - actions types to be hidden / shown in the monitors (while passed to the reducers).
   * If `actionsWhitelist` specified, `actionsBlacklist` is ignored.
   * @deprecated Use actionsDenylist instead.
   */
  actionsBlacklist?: string | string[];
  /**
   * *string or array of strings as regex* - actions types to be hidden / shown in the monitors (while passed to the reducers).
   * If `actionsWhitelist` specified, `actionsBlacklist` is ignored.
   * @deprecated Use actionsAllowlist instead.
   */
  actionsWhitelist?: string | string[];
  /**
   * *string or array of strings as regex* - actions types to be hidden / shown in the monitors (while passed to the reducers).
   * If `actionsAllowlist` specified, `actionsDenylist` is ignored.
   */
  actionsDenylist?: string | string[];
  /**
   * *string or array of strings as regex* - actions types to be hidden / shown in the monitors (while passed to the reducers).
   * If `actionsAllowlist` specified, `actionsDenylist` is ignored.
   */
  actionsAllowlist?: string | string[];
  /**
   * called for every action before sending, takes `state` and `action` object, and returns `true` in case it allows sending the current data to the monitor.
   * Use it as a more advanced version of `actionsDenylist`/`actionsAllowlist` parameters.
   */
  predicate?: <S, A extends Action>(state: S, action: A) => boolean;
  /**
   * if specified as `false`, it will not record the changes till clicking on `Start recording` button.
   * Available only for Redux enhancer, for others use `autoPause`.
   *
   * @default true
   */
  shouldRecordChanges?: boolean;
  /**
   * if specified, whenever clicking on `Pause recording` button and there are actions in the history log, will add this action type.
   * If not specified, will commit when paused. Available only for Redux enhancer.
   *
   * @default "@@PAUSED""
   */
  pauseActionType?: string;
  /**
   * auto pauses when the extension’s window is not opened, and so has zero impact on your app when not in use.
   * Not available for Redux enhancer (as it already does it but storing the data to be sent).
   *
   * @default false
   */
  autoPause?: boolean;
  /**
   * if specified as `true`, it will not allow any non-monitor actions to be dispatched till clicking on `Unlock changes` button.
   * Available only for Redux enhancer.
   *
   * @default false
   */
  shouldStartLocked?: boolean;
  /**
   * if set to `false`, will not recompute the states on hot reloading (or on replacing the reducers). Available only for Redux enhancer.
   *
   * @default true
   */
  shouldHotReload?: boolean;
  /**
   * if specified as `true`, whenever there's an exception in reducers, the monitors will show the error message, and next actions will not be dispatched.
   *
   * @default false
   */
  shouldCatchErrors?: boolean;
  /**
   * If you want to restrict the extension, specify the features you allow.
   * If not specified, all of the features are enabled. When set as an object, only those included as `true` will be allowed.
   * Note that except `true`/`false`, `import` and `export` can be set as `custom` (which is by default for Redux enhancer), meaning that the importing/exporting occurs on the client side.
   * Otherwise, you'll get/set the data right from the monitor part.
   */
  features?: {
    /**
     * start/pause recording of dispatched actions
     */
    pause?: boolean;
    /**
     * lock/unlock dispatching actions and side effects
     */
    lock?: boolean;
    /**
     * persist states on page reloading
     */
    persist?: boolean;
    /**
     * export history of actions in a file
     */
    export?: boolean | "custom";
    /**
     * import history of actions from a file
     */
    import?: boolean | "custom";
    /**
     * jump back and forth (time travelling)
     */
    jump?: boolean;
    /**
     * skip (cancel) actions
     */
    skip?: boolean;
    /**
     * drag and drop actions in the history list
     */
    reorder?: boolean;
    /**
     * dispatch custom actions or action creators
     */
    dispatch?: boolean;
    /**
     * generate tests for the selected actions
     */
    test?: boolean;
  };
  /**
   * Set to true or a stacktrace-returning function to record call stack traces for dispatched actions.
   * Defaults to false.
   */
  trace?: boolean | (<A extends Action>(action: A) => string);
  /**
   * The maximum number of stack trace entries to record per action. Defaults to 10.
   */
  traceLimit?: number;
}

export interface Config extends EnhancerOptions {
  type?: string;
}

interface ConnectResponse {
  init: (state: unknown) => void;
  send: (action: Action<string>, state: unknown) => void;
}

interface ReduxDevtoolsExtension {
  (config?: Config): StoreEnhancer;
  connect: (preConfig: Config) => ConnectResponse;
}

export type InferComposedStoreExt<StoreEnhancers> = StoreEnhancers extends [
  infer HeadStoreEnhancer,
  ...infer RestStoreEnhancers,
]
  ? HeadStoreEnhancer extends StoreEnhancer<infer StoreExt>
    ? StoreExt & InferComposedStoreExt<RestStoreEnhancers>
    : never
  : // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    {};

export interface ReduxDevtoolsExtensionCompose {
  (
    config: Config,
  ): <StoreEnhancers extends readonly StoreEnhancer[]>(
    ...funcs: StoreEnhancers
  ) => StoreEnhancer<InferComposedStoreExt<StoreEnhancers>>;
  <StoreEnhancers extends readonly StoreEnhancer[]>(
    ...funcs: StoreEnhancers
  ): StoreEnhancer<InferComposedStoreExt<StoreEnhancers>>;
}

declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION__?: ReduxDevtoolsExtension;
    __REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: ReduxDevtoolsExtensionCompose;
  }
}

function extensionComposeStub(
  config: Config,
): <StoreEnhancers extends readonly StoreEnhancer[]>(
  ...funcs: StoreEnhancers
) => StoreEnhancer<InferComposedStoreExt<StoreEnhancers>>;
function extensionComposeStub<StoreEnhancers extends readonly StoreEnhancer[]>(
  ...funcs: StoreEnhancers
): StoreEnhancer<InferComposedStoreExt<StoreEnhancers>>;
function extensionComposeStub(...funcs: [Config] | StoreEnhancer[]) {
  if (funcs.length === 0) return undefined;
  if (typeof funcs[0] === "object") return compose;
  return compose(...(funcs as StoreEnhancer[]));
}

export const composeWithDevTools: ReduxDevtoolsExtensionCompose =
  typeof window !== "undefined" && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
    ? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
    : extensionComposeStub;

// WebSocket을 통한 DevTools 연결
export class WebSocketDevToolsConnection {
  private ws: WebSocket | null = null;
  private messageId = 0;
  private currentState: unknown = null;

  constructor(private url = "ws://localhost:2052") {
    console.log(" [WebSocketDevToolsConnection] 생성자 호출됨:", url);
    this.connect();
  }

  private connect(): void {
    try {
      console.log(
        " [WebSocketDevToolsConnection] WebSocket 연결 시도:",
        this.url,
      );
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log(
          "✅ [WebSocketDevToolsConnection] Redux DevTools WebSocket 연결 성공",
        );
        // 초기 연결 메시지 전송
        this.sendMessage({
          type: "INIT",
          payload: this.currentState,
        });
      };

      this.ws.onerror = (error) => {
        console.error(
          "❌ [WebSocketDevToolsConnection] DevTools WebSocket 오류:",
          error,
        );
      };

      this.ws.onclose = () => {
        console.log(
          " [WebSocketDevToolsConnection] DevTools WebSocket 연결 종료",
        );
        // 재연결 시도
        setTimeout(() => this.connect(), 5000);
      };
    } catch (error) {
      console.error(
        "❌ [WebSocketDevToolsConnection] DevTools WebSocket 연결 실패:",
        error,
      );
    }
  }

  private sendMessage(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log(" [WebSocketDevToolsConnection] 메시지 전송:", message);
      this.ws.send(
        JSON.stringify({
          ...message,
          id: ++this.messageId,
          timestamp: Date.now(),
        }),
      );
    } else {
      console.warn(
        "⚠️ [WebSocketDevToolsConnection] WebSocket이 연결되지 않아 메시지 전송 실패:",
        message,
      );
    }
  }

  init(state: unknown) {
    console.log(" [WebSocketDevToolsConnection] init 호출됨:", state);
    this.currentState = state;

    // Redux DevTools 프로토콜에 맞는 형식으로 전송
    this.sendMessage({
      type: "DISPATCH",
      payload: {
        type: "@@INIT",
        state: state,
        timestamp: Date.now(),
      },
    });
  }

  send(action: Action<string>, state: unknown) {
    console.log(" [WebSocketDevToolsConnection] send 호출됨:", {
      action,
      state,
    });
    this.currentState = state;

    // Redux DevTools 프로토콜에 맞는 형식으로 전송
    this.sendMessage({
      type: "DISPATCH",
      payload: {
        type: action.type,
        action: action,
        state: state,
        timestamp: Date.now(),
      },
    });
  }

  disconnect() {
    console.log(" [WebSocketDevToolsConnection] disconnect 호출됨");
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// WebSocket DevTools 연결 생성 함수
export function createWebSocketDevToolsConnection(url = "ws://localhost:2052") {
  console.log("🔧 [createWebSocketDevToolsConnection] 함수 호출됨:", url);
  return new WebSocketDevToolsConnection(url);
}

// Redux Toolkit의 devTools 옵션에 사용할 enhancer 생성
export function createWebSocketDevToolsEnhancer() {
  console.log("🔧 [createWebSocketDevToolsEnhancer] enhancer 생성");

  return (createStore: any) => (reducer: any, initialState?: any) => {
    console.log("🔧 [createWebSocketDevToolsEnhancer] enhancer 실행됨");

    const store = createStore(reducer, initialState);
    console.log("🔧 [createWebSocketDevToolsEnhancer] store 생성됨:", store);

    // WebSocket 연결 생성
    const webSocketConnection = createWebSocketDevToolsConnection();

    // 초기 상태 전송
    webSocketConnection.init(store.getState());

    // 상태 변화 구독
    store.subscribe(() => {
      console.log(
        "🔧 [createWebSocketDevToolsEnhancer] 상태 변화 감지:",
        store.getState(),
      );
      webSocketConnection.init(store.getState());
    });

    console.log(
      "✅ [createWebSocketDevToolsEnhancer] WebSocket DevTools enhancer 설정 완료",
    );

    return store;
  };
}

// 전역 WebSocket 연결 인스턴스
let globalWebSocketConnection: WebSocketDevToolsConnection | null = null;

// store 생성 후 자동으로 WebSocket 연결 추가
function autoConnectWebSocketToStore(store: any) {
  console.log("🔧 [autoConnectWebSocketToStore] store 자동 연결 시작:", store);

  // WebSocket 연결이 없으면 생성
  if (!globalWebSocketConnection) {
    console.log("🔧 [autoConnectWebSocketToStore] WebSocket 연결 생성");
    globalWebSocketConnection = new WebSocketDevToolsConnection(
      "ws://localhost:2052",
    );
  }

  // 초기 상태 전송
  globalWebSocketConnection.init(store.getState());

  // 상태 변화 구독
  store.subscribe(() => {
    console.log(
      "🔧 [autoConnectWebSocketToStore] 상태 변화 감지:",
      store.getState(),
    );
    globalWebSocketConnection?.init(store.getState());
  });

  console.log("✅ [autoConnectWebSocketToStore] WebSocket store 연결 완료");
}

// Redux Toolkit의 configureStore를 자동으로 패치
function patchConfigureStore() {
  console.log("🔧 [patchConfigureStore] configureStore 패치 시작");

  // Redux Toolkit의 configureStore를 가져옴
  const originalConfigureStore = require("@reduxjs/toolkit").configureStore;

  // configureStore를 래핑하여 store 생성 후 자동 연결
  const patchedConfigureStore = (options: any) => {
    console.log("🔧 [patchConfigureStore] configureStore 호출됨:", options);

    // 원본 configureStore 호출
    const store = originalConfigureStore(options);

    // store 생성 후 WebSocket 자동 연결
    console.log("🔧 [patchConfigureStore] store 생성됨, WebSocket 연결 추가");
    autoConnectWebSocketToStore(store);

    return store;
  };

  // 원본 configureStore를 패치된 버전으로 교체
  require("@reduxjs/toolkit").configureStore = patchedConfigureStore;

  console.log("✅ [patchConfigureStore] configureStore 패치 완료");
}

// 자동으로 configureStore 패치 실행
if (typeof global !== "undefined") {
  console.log("🔧 [자동 패치] 시작");
  patchConfigureStore();
  console.log("✅ [자동 패치] 완료");
}

// Redux Toolkit의 devTools 옵션에 사용할 predicate 함수
export function createWebSocketDevToolsPredicate() {
  console.log("🔧 [createWebSocketDevToolsPredicate] predicate 생성");

  return (state: any, action: any) => {
    console.log("🔧 [createWebSocketDevToolsPredicate] predicate 호출됨:", {
      action,
      state,
    });

    // WebSocket 연결이 없으면 생성
    if (!globalWebSocketConnection) {
      console.log("🔧 [createWebSocketDevToolsPredicate] WebSocket 연결 생성");
      globalWebSocketConnection = new WebSocketDevToolsConnection(
        "ws://localhost:2052",
      );
    }

    // 액션과 상태를 WebSocket으로 전송
    try {
      console.log("🔧 [createWebSocketDevToolsPredicate] WebSocket으로 전송:", {
        action,
        state,
      });
      globalWebSocketConnection.send(action, state);
    } catch (error) {
      console.error(
        "❌ [createWebSocketDevToolsPredicate] WebSocket 전송 오류:",
        error,
      );
    }

    // 항상 true를 반환하여 Redux Toolkit DevTools도 계속 동작
    return true;
  };
}

// Redux Toolkit의 devTools 옵션에 사용할 connect 함수
export function createWebSocketDevToolsConnect() {
  console.log("🔧 [createWebSocketDevToolsConnect] 함수 호출됨");

  return (preConfig: Config): ConnectResponse => {
    console.log(
      "🔧 [createWebSocketDevToolsConnect] connect 호출됨:",
      preConfig,
    );

    // WebSocket 연결이 없으면 생성
    if (!globalWebSocketConnection) {
      console.log("🔧 [createWebSocketDevToolsConnect] WebSocket 연결 생성");
      globalWebSocketConnection = new WebSocketDevToolsConnection(
        "ws://localhost:2052",
      );
    }

    return {
      init: (state: unknown) => {
        console.log("🔧 [createWebSocketDevToolsConnect] init 호출됨:", state);
        globalWebSocketConnection?.init(state);
      },
      send: (action: Action<string>, state: unknown) => {
        console.log("🔧 [createWebSocketDevToolsConnect] send 호출됨:", {
          action,
          state,
        });
        globalWebSocketConnection?.send(action, state);
      },
    };
  };
}

// WebSocket 기반 DevTools Extension 생성
function createWebSocketDevToolsExtension(): ReduxDevtoolsExtension {
  console.log("🔧 [createWebSocketDevToolsExtension] 함수 호출됨");
  let connection: WebSocketDevToolsConnection | null = null;

  const connect = (preConfig: Config): ConnectResponse => {
    console.log(
      "🔧 [createWebSocketDevToolsExtension] connect 호출됨:",
      preConfig,
    );

    if (!connection) {
      console.log(
        "🔧 [createWebSocketDevToolsExtension] 새로운 WebSocket 연결 생성",
      );
      connection = new WebSocketDevToolsConnection("ws://localhost:2052");
    } else {
      console.log(
        "🔧 [createWebSocketDevToolsExtension] 기존 WebSocket 연결 재사용",
      );
    }

    const response = {
      init: (state: unknown) => {
        console.log(
          "🔧 [createWebSocketDevToolsExtension] response.init 호출됨:",
          state,
        );
        connection?.init(state);
      },
      send: (action: Action<string>, state: unknown) => {
        console.log(
          "🔧 [createWebSocketDevToolsExtension] response.send 호출됨:",
          {
            action,
            state,
          },
        );
        connection?.send(action, state);
      },
    };

    console.log(
      "🔧 [createWebSocketDevToolsExtension] ConnectResponse 반환:",
      response,
    );
    return response;
  };

  const enhancer = (config?: Config): StoreEnhancer => {
    console.log(
      "🔧 [createWebSocketDevToolsExtension] enhancer 호출됨:",
      config,
    );

    return (createStore) => (reducer, initialState) => {
      console.log(
        "🔧 [createWebSocketDevToolsExtension] enhancer 내부 createStore 호출됨",
      );

      const store = createStore(reducer, initialState);
      console.log("🔧 [createWebSocketDevToolsExtension] store 생성됨:", store);

      // DevTools 연결
      console.log("🔧 [createWebSocketDevToolsExtension] DevTools 연결 시도");
      const devToolsConnection = connect(config || {});
      console.log(
        "🔧 [createWebSocketDevToolsExtension] DevTools 연결 완료:",
        devToolsConnection,
      );

      // 초기 상태 전송
      console.log(
        "🔧 [createWebSocketDevToolsExtension] 초기 상태 전송:",
        store.getState(),
      );
      devToolsConnection.init(store.getState());

      // 상태 변화 구독
      console.log("🔧 [createWebSocketDevToolsExtension] store.subscribe 설정");
      store.subscribe(() => {
        console.log(
          "🔧 [createWebSocketDevToolsExtension] store 상태 변화 감지:",
          store.getState(),
        );
        devToolsConnection.init(store.getState());
      });

      console.log(
        "✅ [createWebSocketDevToolsExtension] WebSocket DevTools enhancer 연결 완료",
      );

      return store;
    };
  };

  const extension = Object.assign(enhancer, { connect });
  console.log(
    "🔧 [createWebSocketDevToolsExtension] Extension 객체 생성 완료:",
    extension,
  );
  return extension;
}

// 전역 객체에 WebSocket DevTools Extension 주입
console.log("🔧 [전역 주입] 시작");
console.log("🔧 [전역 주입] global 존재 여부:", typeof global !== "undefined");
console.log("🔧 [전역 주입] window 존재 여부:", typeof window !== "undefined");

if (typeof global !== "undefined") {
  console.log(" [전역 주입] global 객체에 주입 시작");

  const webSocketDevToolsExtension = createWebSocketDevToolsExtension();
  console.log(
    "🔧 [전역 주입] WebSocket DevTools Extension 생성됨:",
    webSocketDevToolsExtension,
  );

  // global 객체에 주입
  (global as any).__REDUX_DEVTOOLS_EXTENSION__ = webSocketDevToolsExtension;
  console.log(
    "🔧 [전역 주입] global.__REDUX_DEVTOOLS_EXTENSION__ 설정됨:",
    (global as any).__REDUX_DEVTOOLS_EXTENSION__,
  );

  // window 객체도 함께 주입
  if (typeof window !== "undefined") {
    (window as any).__REDUX_DEVTOOLS_EXTENSION__ = webSocketDevToolsExtension;
    console.log(
      "🔧 [전역 주입] window.__REDUX_DEVTOOLS_EXTENSION__ 설정됨:",
      (window as any).__REDUX_DEVTOOLS_EXTENSION__,
    );
  }

  console.log("✅ [전역 주입] WebSocket DevTools Extension 주입 완료");
} else {
  console.log("⚠️ [전역 주입] global 객체가 존재하지 않음");
}

// Redux Toolkit이 호출할 수 있도록 전역 함수도 추가
if (typeof global !== "undefined") {
  (global as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ = composeWithDevTools;
  console.log(" [디버깅] global.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ 설정됨");
}

if (typeof window !== "undefined") {
  (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ = composeWithDevTools;
  console.log(" [디버깅] window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ 설정됨");
}

// Redux Toolkit이 직접 사용할 수 있도록 window 객체에 설정
if (typeof window !== "undefined") {
  // Redux Toolkit이 찾는 정확한 형태로 설정
  window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ = (config: any) => {
    console.log(
      "🔧 [window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__] 호출됨:",
      config,
    );

    return (...funcs: any[]) => {
      console.log(
        "🔧 [window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__] funcs:",
        funcs,
      );

      // Redux의 compose 함수 사용
      const { compose } = require("redux");

      // WebSocket DevTools enhancer 추가
      const webSocketEnhancer = createWebSocketDevToolsEnhancer();

      // 기존 enhancers와 WebSocket enhancer를 함께 compose
      return compose(...funcs, webSocketEnhancer);
    };
  };

  console.log("✅ [window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__] 설정 완료");
}

// 디버깅을 위한 추가 로그
console.log("🔧 [디버깅] 현재 상태 확인:");
console.log(
  " [디버깅] global.__REDUX_DEVTOOLS_EXTENSION__:",
  typeof global !== "undefined"
    ? (global as any).__REDUX_DEVTOOLS_EXTENSION__
    : "global 없음",
);
console.log(
  " [디버깅] window.__REDUX_DEVTOOLS_EXTENSION__:",
  typeof window !== "undefined"
    ? (window as any).__REDUX_DEVTOOLS_EXTENSION__
    : "window 없음",
);
console.log(
  " [디버깅] global.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__:",
  typeof global !== "undefined"
    ? (global as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
    : "global 없음",
);
console.log(
  " [디버깅] window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__:",
  typeof window !== "undefined"
    ? (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
    : "window 없음",
);

composeWithDevTools();

console.log("window", window.__REDUX_DEVTOOLS_EXTENSION__);
console.log("window", window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__);

export {
  composeWithDevTools as composeWithDevToolsDevelopmentOnly,
  devToolsEnhancer as devToolsEnhancerDevelopmentOnly,
} from "./developmentOnly";
export {
  composeWithDevTools as composeWithDevToolsLogOnly,
  devToolsEnhancer as devToolsEnhancerLogOnly,
} from "./logOnly";
export {
  composeWithDevTools as composeWithDevToolsLogOnlyInProduction,
  devToolsEnhancer as devToolsEnhancerLogOnlyInProduction,
} from "./logOnlyInProduction";
