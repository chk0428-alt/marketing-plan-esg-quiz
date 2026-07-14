package com.atomy.quiz;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.ValueCallback;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;
import org.json.JSONException;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final String AUTH_SCHEME = "atomyquiz";
    private static final String RESET_HOST = "reset-callback";
    private static final String SIGNUP_HOST = "signup-callback";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                final WebView webView = (getBridge() != null) ? getBridge().getWebView() : null;
                if (webView == null) {
                    finish();
                    return;
                }
                webView.evaluateJavascript(
                    "(function(){var s=document.getElementById('screen-start'); return (s && !s.hidden) ? 'exit' : 'home';})();",
                    new ValueCallback<String>() {
                        @Override
                        public void onReceiveValue(String value) {
                            if (value != null && value.contains("exit")) {
                                finish();
                            } else {
                                webView.evaluateJavascript(
                                    "(function(){var b=document.getElementById('btn-header-home'); if(b){b.click();}})();",
                                    null
                                );
                            }
                        }
                    }
                );
            }
        });

        handleAuthDeepLink(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleAuthDeepLink(intent);
    }

    // 비밀번호 재설정("atomyquiz://reset-callback#...") 또는 가입 확인
    // ("atomyquiz://signup-callback#...") 이메일 링크를 눌러 앱이 열렸을 때,
    // 그 토큰을 웹뷰(JS)로 전달해 auth.js가 세션을 복구/확정하도록 한다.
    private void handleAuthDeepLink(Intent intent) {
        if (intent == null) {
            return;
        }
        Uri uri = intent.getData();
        if (uri == null || !AUTH_SCHEME.equals(uri.getScheme())) {
            return;
        }
        String host = uri.getHost();
        final String jsCallback;
        final String jsStash;
        if (RESET_HOST.equals(host)) {
            jsCallback = "window.__atomyQuizApplyRecovery";
            jsStash = "window.__atomyQuizRecovery";
        } else if (SIGNUP_HOST.equals(host)) {
            jsCallback = "window.__atomyQuizApplySignupConfirm";
            jsStash = "window.__atomyQuizSignupConfirm";
        } else {
            return;
        }
        String fragment = uri.getFragment();
        if (fragment == null || fragment.isEmpty()) {
            return;
        }

        String accessToken = null;
        String refreshToken = null;
        for (String pair : fragment.split("&")) {
            int eq = pair.indexOf('=');
            if (eq <= 0) {
                continue;
            }
            String key = pair.substring(0, eq);
            String value = decodeUriComponent(pair.substring(eq + 1));
            if ("access_token".equals(key)) {
                accessToken = value;
            } else if ("refresh_token".equals(key)) {
                refreshToken = value;
            }
        }

        if (accessToken == null || refreshToken == null) {
            return;
        }

        final String js;
        try {
            JSONObject payload = new JSONObject();
            payload.put("access_token", accessToken);
            payload.put("refresh_token", refreshToken);
            js = "(function(){"
                + jsStash + " = " + payload.toString() + ";"
                + "if (typeof " + jsCallback + " === 'function') {"
                + jsCallback + "(" + jsStash + ");"
                + "}"
                + "})();";
        } catch (JSONException e) {
            // 토큰 payload 구성 실패 시 조용히 무시한다(재설정 링크가 손상된 경우).
            return;
        }

        // 콜드 스타트(앱이 완전히 종료된 상태에서 딥링크로 실행됨)일 때는 이 시점에
        // 웹뷰가 아직 index.html 로딩을 끝내지 않아 evaluateJavascript가 실행돼도
        // 곧 버려질 빈 문서에 값이 심어져 사라진다. 로딩이 끝날 시간을 벌어주기 위해
        // 짧은 간격으로 몇 차례 재주입한다(각 호출은 멱등적이라 중복 실행돼도 안전함).
        Handler handler = new Handler(Looper.getMainLooper());
        int[] delaysMs = { 0, 400, 900, 1800, 3000 };
        for (int delayMs : delaysMs) {
            handler.postDelayed(new Runnable() {
                @Override
                public void run() {
                    WebView webView = (getBridge() != null) ? getBridge().getWebView() : null;
                    if (webView != null) {
                        webView.evaluateJavascript(js, null);
                    }
                }
            }, delayMs);
        }
    }

    private static String decodeUriComponent(String value) {
        try {
            return URLDecoder.decode(value, "UTF-8");
        } catch (UnsupportedEncodingException e) {
            return value;
        }
    }
}
