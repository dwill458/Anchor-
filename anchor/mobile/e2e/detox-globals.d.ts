declare global {
  const device: any;
  const element: any;
  const by: any;
  function waitFor(element: any): any;

  namespace jest {
    interface Matchers<R> {
      toBeVisible(): R;
      toBeEnabled(): R;
      toBeDisabled(): R;
      toHaveToggleValue(value: boolean): R;
    }
  }
}

export {};
