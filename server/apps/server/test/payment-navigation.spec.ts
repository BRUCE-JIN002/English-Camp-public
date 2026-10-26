import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { transpileModule, ModuleKind } from 'typescript';
const source = readFileSync(resolve(__dirname, '../../../../apps/web/src/views/Course/components/Pay.vue'), 'utf8');
const handler = source.slice(source.indexOf('  // Reserve the tab'), source.indexOf('  // 关闭支付弹窗'));
function setup(blocked = false) {
  let resolveOrder: Function, rejectOrder: Function;
  const createPay = jest.fn(() => new Promise((resolve, reject) => { resolveOrder = resolve; rejectOrder = reject; }));
  const tab = { opener: {}, closed: false, close: jest.fn(), document: { title: '', body: { textContent: '' } }, location: { replace: jest.fn() } };
  const context: any = {
    isCreating: { value: false }, isPay: { value: false }, paymentUrl: { value: '' }, paymentRevision: 0, pendingWindow: null,
    modelValue: { value: true }, timeExpire: { value: 0 },
    props: { course: { id: 'course', name: 'English', teacher: 'test', price: '1' } },
    window: { open: jest.fn(() => blocked ? null : tab) }, createPay, URL,
    ElMessage: { error: jest.fn(), warning: jest.fn() },
  };
  const { outputText } = transpileModule(handler + '\nglobalThis.confirmPayment = onConfirm;', { compilerOptions: { module: ModuleKind.CommonJS } });
  runInNewContext(outputText, context);
  return { context, tab, resolve: () => resolveOrder({ code: 200, data: { payUrl: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do?order=test', timeExpire: 123 } }), reject: () => rejectOrder(new Error('offline')) };
}
it('opens before the async request and navigates the reserved tab after it resolves', async () => {
  const f = setup(); const task = f.context.confirmPayment();
  expect(f.context.window.open.mock.invocationCallOrder[0]).toBeLessThan(f.context.createPay.mock.invocationCallOrder[0]);
  await f.context.confirmPayment(); expect(f.context.createPay).toHaveBeenCalledTimes(1);
  f.resolve(); await task;
  expect(f.tab.location.replace).toHaveBeenCalledWith(f.context.paymentUrl.value);
  expect(f.context.isPay.value).toBe(true);
});
it('retains the existing payment URL when popups are blocked', async () => {
  const f = setup(true); const task = f.context.confirmPayment(); f.resolve(); await task;
  expect(f.context.paymentUrl.value).toContain('order=test');
  expect(f.context.ElMessage.warning).toHaveBeenCalled();
});
it('closes the blank tab and permits retry on a failed request', async () => {
  const f = setup(); const task = f.context.confirmPayment(); f.reject(); await task;
  expect(f.tab.close).toHaveBeenCalled(); expect(f.context.isCreating.value).toBe(false);
  expect(f.context.isPay.value).toBe(false); expect(f.context.paymentUrl.value).toBe('');
});
it('does not redirect a closed or superseded payment dialog', async () => {
  const f = setup(); const task = f.context.confirmPayment(); f.context.paymentRevision++; f.resolve(); await task;
  expect(f.tab.close).toHaveBeenCalled(); expect(f.tab.location.replace).not.toHaveBeenCalled();
});
