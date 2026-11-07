import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render} from '@testing-library/react';
import SelectModeActions from '@/app/library/components/SelectModeActions';
vi.mock('@/hooks/useTranslation',()=>({useTranslation:()=>(s:string)=>s}));
vi.mock('@/hooks/useKeyDownActions',()=>({useKeyDownActions:vi.fn()}));
afterEach(cleanup);
it('shows Done for manual order editing and exits through the existing selection cleanup',()=>{
 const exit=vi.fn(),noop=vi.fn();
 const actions=(isReordering:boolean)=><SelectModeActions selectedBooks={['a'.repeat(32)]} safeAreaBottom={0}
 isReordering={isReordering} onOpen={noop} onGroup={noop} onTag={noop} onDetails={noop} onStatus={noop}
 onDownload={noop} onSend={noop} onDelete={noop} onCancel={exit}/>;
 const result=render(actions(true));
 fireEvent.click(result.getByRole('button',{name:'완료'}));expect(exit).toHaveBeenCalledOnce();
 expect(result.queryByRole('button',{name:'Cancel'})).toBeNull();
 result.rerender(actions(false));expect(result.getByRole('button',{name:'Cancel'})).toBeTruthy();
});
