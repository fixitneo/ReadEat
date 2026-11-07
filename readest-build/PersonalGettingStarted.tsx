'use client';
const sections = [
  ['책 넣기','서재의 책 추가를 눌러 EPUB이나 PDF 파일을 선택하세요. 책이 들어 있는 폴더를 연결해 한꺼번에 가져올 수도 있습니다.'],
  ['책 읽기','책 표지를 누르면 열립니다. 화면 가장자리를 누르거나 손가락으로 밀면 다음 장으로 갑니다.'],
  ['종이처럼 넘기기','손가락을 댄 위치에 따라 책장이 휘어집니다. 중간에 손가락을 되돌리면 넘기기를 취소할 수 있습니다. 넘기는 속도와 소리는 설정에서 바꿉니다.'],
  ['글자와 화면','글자가 작으면 글자 크기를 키우세요. 여백, 줄 간격, 배경색도 바꿀 수 있습니다. 이 책에만 적용할지 모든 책에 적용할지도 고를 수 있습니다.'],
  ['뜻과 번역 찾기','모르는 단어나 문장을 길게 눌러 선택하세요. 작은 도구창에서 사전을 누르면 사전 1이, 사전 버튼을 길게 누르면 사전 2가 열립니다.'],
  ['단어장에 담기','문구를 선택한 뒤 단어장에 추가를 누르세요. 여러 책에서 모은 단어를 한곳에서 찾고 뜻이나 생각을 적어 둘 수 있습니다.'],
  ['중요한 문장 표시','문장을 길게 눌러 고른 뒤 하이라이트나 밑줄을 선택하세요. 주석을 달거나 태그를 붙여 나중에 다시 찾을 수 있습니다.'],
  ['책갈피와 독서 노트','다시 볼 페이지에는 책갈피를 꽂으세요. 책 옆 목록의 독서 노트에는 생각을 적습니다. 서재 메뉴에서는 여러 책의 노트를 모아 봅니다.'],
  ['책 순서 바꾸기','정렬에서 사용자 정렬을 고르세요. 책을 길게 눌러 선택한 뒤 이동 손잡이로 순서를 바꿉니다. 여러 권도 함께 옮길 수 있고, 끝나면 완료를 누릅니다.'],
  ['폴더 관리','연결한 폴더는 바꾸거나 연결을 지울 수 있습니다. 연결을 지우면 그 폴더에서 가져온 책은 서재에서 사라지지만 원본 파일은 삭제되지 않습니다.'],
  ['소리 내어 읽기','읽어 주기를 누르면 책을 소리로 들을 수 있습니다. 목소리와 속도는 읽어 주기 설정에서 바꿉니다.'],
  ['내 서버와 백업','내 서버 동기화는 여러 기기의 기록을 맞추는 기능입니다. ZIP 백업은 따로 보관하는 복사본입니다. 중요한 기록은 백업해 두고, 복원할 때는 가져올 항목을 확인하세요.'],
  ['도구창 바꾸기','선택 도구 편집에서 자주 쓰는 버튼만 남기고 순서를 바꿀 수 있습니다. 단어장 버튼이 보이지 않을 때도 여기서 추가합니다.'],
];
export default function PersonalGettingStarted({onDone}:{onDone:()=>void}) {
  return <main className='bg-base-100 text-base-content mx-auto max-w-4xl space-y-6 p-5 text-base leading-relaxed' aria-label='처음 사용 안내'>
    <header><h1 className='text-2xl font-semibold'>내 서재, 이렇게 사용하세요</h1>
      <p className='mt-3'>처음부터 모두 익힐 필요는 없습니다. 책 한 권을 열어 읽어 보세요. 이 안내는 설정의 도움말에서 다시 볼 수 있습니다.</p></header>
    <div className='grid gap-4 md:grid-cols-2'>{sections.map(([title,description],index)=>
      <section key={title} className='eink-bordered border-base-content/20 rounded-xl border p-4'>
        <h2 className='mb-2 text-lg font-semibold'>{index+1}. {title}</h2><p>{description}</p>
      </section>)}</div>
    <button type='button' className='btn btn-contrast min-h-12 w-full text-base' onClick={onDone}>서재 시작하기</button>
  </main>;
}
