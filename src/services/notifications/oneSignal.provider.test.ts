import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    initialize: vi.fn(),
    setPaused: vi.fn(),
    permissionNative: vi.fn(),
}));

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("react-native-onesignal", () => ({
    OneSignal: {
        initialize: mocks.initialize,
        InAppMessages: { setPaused: mocks.setPaused },
        Notifications: {
            permissionNative: mocks.permissionNative,
            addEventListener: mocks.addEventListener,
            removeEventListener: mocks.removeEventListener,
        },
        User: {
            pushSubscription: {
                addEventListener: mocks.addEventListener,
                removeEventListener: mocks.removeEventListener,
            },
        },
    },
}));

describe("OneSignal provider initialization lifecycle", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it("waits for native initialization and registers listeners once", async () => {
        let resolveNativeInitialization: () => void = () => undefined;
        const nativeInitialization = new Promise<void>((resolve) => {
            resolveNativeInitialization = resolve;
        });
        mocks.permissionNative.mockImplementation(() => nativeInitialization.then(() => 1));
        const { oneSignalNotificationProvider } = await import("./oneSignal.provider");
        const handlers = {
            onNotificationOpened: vi.fn(),
            onForegroundNotification: vi.fn(),
        };

        const initialization = oneSignalNotificationProvider.initialize({ appId: "test-app-id" });
        const firstListeners = oneSignalNotificationProvider.addListeners(handlers);
        const secondListeners = oneSignalNotificationProvider.addListeners(handlers);
        await Promise.resolve();
        expect(mocks.initialize).toHaveBeenCalledTimes(1);
        expect(mocks.addEventListener).not.toHaveBeenCalled();

        resolveNativeInitialization();
        await Promise.all([initialization, firstListeners, secondListeners]);
        expect(mocks.addEventListener).toHaveBeenCalledTimes(4);

        const cleanup = await firstListeners;
        cleanup();
        expect(mocks.removeEventListener).toHaveBeenCalledTimes(4);
    });
});
