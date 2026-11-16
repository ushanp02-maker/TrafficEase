package lk.trafficease.government;
import java.util.Arrays;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
/** Operator-only console tool. Never accepts a password in arguments or environment. */
public final class GovernmentPasswordTool {
    public static void main(String[] args) {
        var console=System.console();
        if(console==null) throw new IllegalStateException("Run in a real terminal; password input must not be echoed or supplied in command arguments.");
        char[] first=console.readPassword("New government DEMO password (14+ characters): ");
        char[] second=console.readPassword("Confirm password: ");
        try {
            if(first==null || second==null || first.length<14 || new String(first).getBytes(java.nio.charset.StandardCharsets.UTF_8).length>72 || !Arrays.equals(first,second))
                throw new IllegalArgumentException("Use matching passwords of 14–72 characters.");
            console.printf("Bcrypt hash (store only in protected backend configuration):%n%s%n",new BCryptPasswordEncoder(12).encode(new String(first)));
        } finally { if(first!=null)Arrays.fill(first,'\0');if(second!=null)Arrays.fill(second,'\0'); }
    }
}
