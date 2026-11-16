package lk.trafficease.government;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.*;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.*;
import org.springframework.web.bind.annotation.*;
import java.io.IOException;
import java.time.Instant;
import java.util.*;

@Configuration
public class GovernmentSecurity {
    @Bean UserDetailsService demoAccounts(@Value("${GOV_DEMO_USERNAME:}") String username,
                                         @Value("${GOV_DEMO_PASSWORD_HASH:}") String hash) {
        var users = new InMemoryUserDetailsManager();
        if (!hash.isBlank()) {
            if (!hash.matches("\\$2[aby]\\$1[0-4]\\$[./A-Za-z0-9]{53}") || !username.matches("[a-zA-Z0-9._-]{3,64}"))
                throw new IllegalArgumentException("Government demo requires a valid username and bcrypt hash (cost 10–14), not a plaintext password");
            users.createUser(User.withUsername(username).password(hash).roles("GOVERNMENT_DEMO").build());
        }
        return users;
    }
    @Bean BCryptPasswordEncoder governmentEncoder() { return new BCryptPasswordEncoder(12); }
    private static final class Attempts {
        record Window(int count, long ends) {}
        private final Map<String, Window> values = new LinkedHashMap<>();
        synchronized boolean allowed(String key) {
            values.values().removeIf(w -> w.ends < System.currentTimeMillis());
            return values.size() < 1000 && values.getOrDefault(key, new Window(0,0)).count < 5;
        }
        synchronized void failed(String key) {
            if (values.size() < 1000 || values.containsKey(key)) {
                var old = values.get(key); long now = System.currentTimeMillis();
                values.put(key, new Window(old == null ? 1 : old.count + 1, old == null ? now + 600_000 : old.ends));
            }
        }
        synchronized void clear(String key) { values.remove(key); }
    }
    static void json(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status); response.setContentType("application/json");
        new ObjectMapper().writeValue(response.getWriter(), Map.of("message", message));
    }
    @Bean SecurityFilterChain governmentChain(HttpSecurity http, GovernmentService government) throws Exception {
        var attempts = new Attempts();
        var limiter = new org.springframework.web.filter.OncePerRequestFilter() {
            @Override protected void doFilterInternal(HttpServletRequest r, HttpServletResponse s, FilterChain chain) throws ServletException, IOException {
                boolean login=org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher.withDefaults().matcher(HttpMethod.POST,"/api/government/login").matches(r);
                if(login && ((r.getParameter("username")!=null && r.getParameter("username").length()>64)
                    || (r.getParameter("password")!=null && r.getParameter("password").getBytes(java.nio.charset.StandardCharsets.UTF_8).length>72))) {
                    json(s,400,"Use a username of at most 64 characters and a password of at most 72 UTF-8 bytes.");return;
                }
                if (login && !attempts.allowed(r.getRemoteAddr())) {
                    s.setHeader("Retry-After", "600"); json(s,429,"Too many demo login attempts. Wait ten minutes."); return;
                }
                chain.doFilter(r,s);
            }
        };
        http.authorizeHttpRequests(auth -> auth
            .requestMatchers("/api/government/session", "/api/government/login").permitAll()
            .requestMatchers("/api/government/**").hasRole("GOVERNMENT_DEMO")
            .requestMatchers("/api/**", "/error").permitAll().anyRequest().denyAll())
            .csrf(csrf -> csrf.ignoringRequestMatchers("/api/routes", "/api/ar/routes", "/api/forecasts"))
            .requestCache(cache -> cache.disable())
            .formLogin(form -> form.loginProcessingUrl("/api/government/login")
                .successHandler((r,s,a) -> { attempts.clear(r.getRemoteAddr()); government.loginAudit(a.getName(), true); json(s,200,"Government demo session established. No official government authorization."); })
                .failureHandler((r,s,e) -> { attempts.failed(r.getRemoteAddr()); government.loginAudit("unverified",false); json(s,401,"Demo login failed. Check the configured account."); }))
            .logout(logout -> logout.logoutUrl("/api/government/logout").invalidateHttpSession(true).deleteCookies("JSESSIONID")
                .addLogoutHandler((r,s,a) -> { if (a != null) government.loginAudit(a.getName(),true,"LOGOUT"); })
                .logoutSuccessHandler((r,s,a) -> json(s,200,"Signed out.")))
            .exceptionHandling(errors -> errors
                .authenticationEntryPoint((r,s,e) -> json(s,401,"A government demo session is required."))
                .accessDeniedHandler((r,s,e) -> json(s,403,"Access denied or CSRF token missing/expired. Refresh your session.")))
            .sessionManagement(session -> session.sessionFixation(fix -> fix.changeSessionId()))
            .addFilterBefore(limiter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
    @RestController
    static class SessionController {
        private final boolean configured;
        SessionController(@Value("${GOV_DEMO_PASSWORD_HASH:}") String hash) { configured = !hash.isBlank(); }
        @GetMapping("/api/government/session")
        Map<String,Object> session(org.springframework.security.core.Authentication auth, CsrfToken csrf) {
            boolean permitted = auth != null && auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_GOVERNMENT_DEMO"));
            return Map.of("authenticated",permitted,"username",permitted ? auth.getName() : "", "role",permitted ? "GOVERNMENT_DEMO" : "NONE", "configured",configured,"csrfToken",csrf.getToken(),"demonstration",true);
        }
    }
}
