package cloud.noryangjinbjj.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** 사이트를 전체 화면으로 보여 주는 앱. 사이트 주소만 바꾸려면 START_URL 한 줄만 고치면 된다. */
public class MainActivity extends Activity {
    private static final String START_URL = "https://www.noryangjinbjj.cloud/";
    // 앱 안에서 열 주소. 그 밖의 주소(유튜브 등)는 해당 앱이나 브라우저로 넘긴다.
    private static final String[] INTERNAL_HOSTS = { "noryangjinbjj.cloud", "github.io" };

    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (isInternal(u)) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Exception ignored) { }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) {
                    String html = "<meta name='viewport' content='width=device-width, initial-scale=1'>"
                        + "<body style='font-family:sans-serif;text-align:center;padding:64px 24px;color:#4e5968;background:#f2f4f6'>"
                        + "<h3 style='color:#191f28'>인터넷에 연결할 수 없습니다</h3>"
                        + "<p>연결을 확인한 뒤 다시 시도해 주세요.</p>"
                        + "<p><a href='" + START_URL + "' style='color:#3182f6;font-weight:bold'>다시 시도</a></p>";
                    view.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
                }
            }
        });

        if (state != null) web.restoreState(state);
        else web.loadUrl(START_URL);
    }

    private boolean isInternal(Uri u) {
        String scheme = u.getScheme();
        if (scheme == null || !scheme.equals("https")) return false;
        String host = u.getHost();
        if (host == null) return false;
        for (String h : INTERNAL_HOSTS) {
            if (host.equals(h) || host.endsWith("." + h)) return true;
        }
        return false;
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
