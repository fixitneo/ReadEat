'use client';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const sections = [
  {title:'처음 시작하기', items:[
    ['책은 어떻게 넣나요?', '책장 위쪽의 + 버튼을 누르고 책 파일을 고르세요. 폴더에서 여러 책을 가져올 수도 있습니다.'],
    ['책이 안 보이면 어떻게 하나요?', '책장의 검색어와 필터를 확인하세요. 읽는 중, 완료, 즐겨찾기 등을 선택하면 해당 책만 보입니다.'],
    ['읽던 곳으로 돌아갈 수 있나요?', '책을 다시 열면 마지막으로 읽던 위치부터 이어서 볼 수 있습니다.'] ]},
  {title:'페이지 읽기와 PDF', items:[
    ['페이지는 어떻게 넘기나요?', '화면의 왼쪽이나 오른쪽을 누르거나 쓸어 보세요. 동작이 다르면 읽기 화면의 개인 설정에서 터치 영역을 확인하세요.'],
    ['PDF 글씨가 너무 작아요.', '읽기 설정에서 PDF 페이지 맞춤을 너비 맞춤으로 바꾸거나 확대하세요. 텍스트가 포함된 PDF는 상단 문서 모양 버튼으로 텍스트 모드를 사용할 수 있습니다.'],
    ['PDF 글자가 흐릿하거나 보이지 않아요.', '원본 PDF 보기로 바꾸고 테마에 의한 PDF 색 변환을 해제해 보세요. 사진으로 만든 스캔 PDF는 텍스트 모드에서 글자가 추출되지 않을 수 있습니다.'],
    ['두 페이지 중 오른쪽이 잘려요.', 'PDF 설정의 페이지 배치를 단일 페이지로 변경하고, 화면을 접거나 펼친 뒤 크기를 다시 맞춰 보세요.'] ]},
  {title:'글자와 화면 꾸미기', items:[
    ['글씨 크기와 줄 간격도 바꿀 수 있나요?', '읽기 설정에서 글씨 크기, 글꼴, 줄 간격, 여백, 테마를 바꿀 수 있습니다. PDF 원본 페이지에서는 글꼴 변경이 적용되지 않을 수 있습니다.'],
    ['배경 사진을 넣을 수 있나요?', '설정의 배경 이미지에서 사진을 가져올 수 있습니다. 화면 채우기 또는 전체 보이기를 고르고, 사진 구도 조절로 확대하거나 위치를 옮길 수 있습니다.'],
    ['나만의 CSS를 사용할 수 있나요?', 'CSS 파일을 가져온 뒤 켜고 끌 수 있습니다. 잘못된 CSS는 화면 표시를 바꿀 수 있으므로 문제가 생기면 해당 파일을 꺼 주세요.'] ]},
  {title:'메모와 관리', items:[
    ['북마크와 밑줄은 어떻게 남기나요?', '읽기 화면에서 책갈피 버튼을 누르거나 글을 길게 눌러 선택한 뒤 강조 또는 메모를 사용하세요.'],
    ['책의 상태를 나눌 수 있나요?', '읽는 중·완료·읽지 않음·즐겨찾기와 직접 만든 상태로 책을 정리할 수 있습니다.'],
    ['설정을 옮길 수 있나요?', '설정의 백업·복원에서 내보내기와 가져오기를 사용하세요. 이미지 등 일부 파일이 포함되었는지 백업 항목을 확인하세요.'] ]},
  {title:'내 마음대로 바꾸기', items:[
    ['하단 버튼과 터치 위치도 바꿀 수 있나요?', '읽기 화면의 개인 설정에서 하단 버튼과 3×3 터치 영역에 동작을 지정할 수 있습니다.'],
    ['접은 화면과 펼친 화면을 따로 설정할 수 있나요?', '폴더블 기기는 접힌 화면과 펼친 화면의 터치 배치를 각각 저장할 수 있습니다. 배경 사진 구도도 화면별로 조절할 수 있습니다.'],
    ['페이지 넘김 소리도 바꿀 수 있나요?', '읽기 설정에서 기본 소리를 선택하거나 짧은 소리 파일을 추가할 수 있습니다.'] ]},
  {title:'문제가 생겼을 때', items:[
    ['화면이 이상해졌어요.', '테마와 CSS를 기본값으로 바꾼 뒤 책을 다시 열어 보세요. 문제가 계속되면 PDF 한 파일만 문제인지 다른 책에서도 생기는지 확인해 주세요.'],
    ['다른 기기에서도 이어 읽고 싶어요.', '동기화 서비스 또는 백업·복원을 설정하세요. 동기화되는 항목은 연결 방식과 선택한 옵션에 따라 다릅니다.'],
    ['설정을 바꾸면 원본 책이 변하나요?', '보통 화면 표시 방식만 바뀌며 원본 책 파일은 그대로 유지됩니다.'] ]},
] as const;

export default function PersonalShelfHelp({open,onClose}:{open:boolean;onClose:()=>void}) {
  const [query,setQuery]=useState('');
  useEffect(()=>{
    if(!open)return;
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[open,onClose]);
  if(!open || typeof document==='undefined')return null;
  const q=query.trim().toLocaleLowerCase();
  return createPortal(
    <div role='presentation' className='fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 px-3 py-5'
      onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
      <section role='dialog' aria-modal='true' aria-label='도움말' className='bg-base-100 text-base-content flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl shadow-2xl'>
        <div className='flex items-center justify-between gap-3 border-b border-base-content/10 p-4'>
          <div><h2 className='text-lg font-bold'>도움말</h2><p className='text-sm opacity-70'>궁금한 내용을 누르면 설명이 열립니다.</p></div>
          <button type='button' autoFocus aria-label='도움말 닫기' className='btn btn-ghost btn-sm' onClick={onClose}>닫기 ✕</button>
        </div>
        <div className='overflow-y-auto overscroll-contain p-4 text-base'>
          <label className='mb-5 block'><span className='sr-only'>도움말 검색</span>
            <input className='input input-bordered w-full' type='search' placeholder='궁금한 내용 검색' value={query} onChange={e=>setQuery(e.target.value)}/>
          </label>
          {sections.map(section=>{
            const items=section.items.filter(([title,answer])=>(title+' '+answer).toLocaleLowerCase().includes(q));
            if(!items.length)return null;
            return <div key={section.title} className='mb-6'>
              <h3 className='mb-2 text-base font-semibold'>{section.title}</h3>
              <div className='divide-y divide-base-content/10 overflow-hidden rounded-xl border border-base-content/10'>
                {items.map(([title,answer])=><details key={title} className='group px-4 py-3'>
                  <summary className='cursor-pointer select-none font-medium leading-relaxed'>{title}</summary>
                  <p className='mt-3 text-sm leading-relaxed opacity-85'>{answer}</p>
                </details>)}
              </div>
            </div>;
          })}
          {q&&!sections.some(s=>s.items.some(([a,b])=>(a+' '+b).toLocaleLowerCase().includes(q)))&&
            <p className='py-8 text-center'>찾는 내용이 없습니다. 다른 말로 검색해 보세요.</p>}
        </div>
      </section>
    </div>,
    document.body,
  );
}
