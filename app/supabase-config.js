/*
 * Supabase 프로젝트 연결 설정 (3단계: 계정/로그인 + 학습이력 서버 동기화)
 *
 * 아래 두 값을 Supabase 대시보드 > 프로젝트 > Project Settings > API 메뉴에서
 * 확인해 채워 넣으세요.
 *   - SUPABASE_URL: "Project URL" (예: https://abcdefghijk.supabase.co)
 *   - SUPABASE_ANON_KEY: "anon public" 키 (공개해도 되는 키입니다. 절대로
 *     "service_role" 키는 이 파일에 넣지 마세요 — 그 키는 서버 전용입니다.)
 *
 * 값을 채우지 않은 상태(placeholder)에서는 로그인/서버 동기화 기능이 자동으로
 * 비활성화되고, 기존 1~2단계처럼 LocalStorage만 사용하는 오프라인 모드로 동작합니다.
 */
var SUPABASE_URL = "https://nhnhglzvrvfrtlrtofxu.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5obmhnbHp2cnZmcnRscnRvZnh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NzAyNDMsImV4cCI6MjA5ODU0NjI0M30.CpEBoTkyiM-zuAPK3meNvK6BHxC3WoBHiBsTkcNStN0";
