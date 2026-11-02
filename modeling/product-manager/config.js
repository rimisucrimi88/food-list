// Supabase 연결 설정
// 두 값을 모두 채우면 Supabase에 연결하고, 비워 두면 데모 모드(브라우저에만 저장)로 동작한다
// anon(공개) 키만 넣는다. service_role 키는 절대 넣지 않는다
// 이 파일에 키를 넣었다면 외부에 공유하거나 올리지 않는다
window.APP_CONFIG = {
  SUPABASE_URL: '',      // 예: https://abcdefgh.supabase.co
  SUPABASE_ANON_KEY: '', // Project Settings > API 의 anon public 키
};
