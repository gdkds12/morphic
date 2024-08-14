// src/fonts.ts
import localFont from 'next/font/local'

// 로컬 폰트 설정
const pretendard = localFont({
  src: './fonts/PretendardVariable.woff2', // public 폴더 내의 폰트 파일 경로
  display: 'swap',  // 폰트 로딩 전략
  weight: '45 920', // 폰트 굵기 범위
})

export default pretendard
