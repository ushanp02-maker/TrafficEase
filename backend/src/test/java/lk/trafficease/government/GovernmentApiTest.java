package lk.trafficease.government;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
@SpringBootTest @AutoConfigureMockMvc
class GovernmentApiTest {
    static final String PASSWORD=UUID.randomUUID().toString();
    @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
        r.add("GOV_DEMO_USERNAME",()->"coursework-admin");
        String hash=new BCryptPasswordEncoder(10).encode(PASSWORD);r.add("GOV_DEMO_PASSWORD_HASH",()->hash);
    }
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    String body(String title) throws Exception {
        return json.writeValueAsString(Map.of("title",title,"body","A clearly identified demonstration announcement for testing only.","category","ROAD_CLOSURE","region","CENTRAL","affectedArea","Hypothetical coursework road","validFrom",Instant.now().plusSeconds(60).toString(),"validUntil",Instant.now().plusSeconds(3600).toString()));
    }
    @Test void publicApisRemainUsableButAnonymousAdminIsDenied() throws Exception {
        mvc.perform(get("/api/health")).andExpect(status().isOk());
        mvc.perform(get("/api/announcements")).andExpect(status().isOk()).andExpect(jsonPath("$.demonstration").value(true));
        mvc.perform(get("/api/government/announcements")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/government/analytics")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/government/announcements").with(csrf()).contentType("application/json").content(body("Unauthorized attempt"))).andExpect(status().isUnauthorized());
    }
    @Test void mappedForecastIsPublicButDoesNotExemptGovernmentCsrf() throws Exception {
        mvc.perform(post("/api/route-forecasts").contentType("application/json").content("{\"journeyId\":\"unsupported\"}"))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("UNSUPPORTED_JOURNEY"));
        mvc.perform(post("/api/government/announcements").contentType("application/json").content("{}"))
            .andExpect(status().isForbidden());
    }
    @Test @WithMockUser(roles="CITIZEN") void citizenRoleCannotManageNotices() throws Exception {
        mvc.perform(get("/api/government/announcements")).andExpect(status().isForbidden());
        mvc.perform(post("/api/government/announcements").with(csrf()).contentType("application/json").content(body("Forbidden attempt"))).andExpect(status().isForbidden());
    }
    @Test @WithMockUser(roles="GOVERNMENT_DEMO") void mutationRequiresCsrfAndInputValidation() throws Exception {
        mvc.perform(post("/api/government/announcements").contentType("application/json").content(body("Missing CSRF"))).andExpect(status().isForbidden());
        mvc.perform(post("/api/government/announcements").with(csrf()).contentType("application/json").content("{}")).andExpect(status().isBadRequest());
    }
    @Test @WithMockUser(username="coursework-admin",roles="GOVERNMENT_DEMO") void draftEditPublishWithdrawAndAuditReachCitizenFeed() throws Exception {
        String title="Test notice "+UUID.randomUUID();
        var response=mvc.perform(post("/api/government/announcements").with(csrf()).contentType("application/json").content(body(title)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("DRAFT")).andReturn();
        var a=json.readTree(response.getResponse().getContentAsString());String id=a.path("id").asText();
        assertFalse(mvc.perform(get("/api/announcements")).andReturn().getResponse().getContentAsString().contains(id));
        mvc.perform(post("/api/government/announcements/"+id+"/state").with(csrf()).contentType("application/json").content("{\"status\":\"PUBLISHED\",\"revision\":1}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.demonstration").value(true));
        assertTrue(mvc.perform(get("/api/announcements").param("region","CENTRAL").param("category","ROAD_CLOSURE")).andReturn().getResponse().getContentAsString().contains(title));
        assertFalse(mvc.perform(get("/api/announcements").param("region","UVA")).andReturn().getResponse().getContentAsString().contains(id));
        var edit=(com.fasterxml.jackson.databind.node.ObjectNode)json.readTree(body(title+" updated"));edit.put("revision",2);
        mvc.perform(put("/api/government/announcements/"+id).with(csrf()).contentType("application/json").content(edit.toString())).andExpect(status().isOk()).andExpect(jsonPath("$.revision").value(3));
        mvc.perform(put("/api/government/announcements/"+id).with(csrf()).contentType("application/json").content(edit.toString())).andExpect(status().isConflict());
        mvc.perform(post("/api/government/announcements/"+id+"/state").with(csrf()).contentType("application/json").content("{\"status\":\"WITHDRAWN\",\"revision\":3}")).andExpect(status().isOk());
        assertFalse(mvc.perform(get("/api/announcements")).andReturn().getResponse().getContentAsString().contains(id));
        var audit=mvc.perform(get("/api/government/audit")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();assertTrue(audit.contains("WITHDRAWN"));assertFalse(audit.contains(PASSWORD));
        mvc.perform(get("/api/government/analytics")).andExpect(jsonPath("$.realDemandAvailable").value(false)).andExpect(jsonPath("$.mobilityCollectionEnabled").value(false));
    }
    @Test void realLoginRotatesSessionAndLogoutRemovesPrivileges() throws Exception {
        var before=mvc.perform(get("/api/government/session")).andExpect(jsonPath("$.authenticated").value(false)).andReturn();
        MockHttpSession session=(MockHttpSession)before.getRequest().getSession();String old=session.getId();
        mvc.perform(post("/api/government/login").session(session).with(csrf()).param("username","coursework-admin").param("password",PASSWORD)).andExpect(status().isOk());
        assertNotEquals(old,session.getId());
        mvc.perform(get("/api/government/analytics").session(session)).andExpect(status().isOk());
        mvc.perform(post("/api/government/logout").session(session).with(csrf())).andExpect(status().isOk());assertTrue(session.isInvalid());
        mvc.perform(get("/api/government/analytics")).andExpect(status().isUnauthorized());
    }
    @Test void loginMissingCsrfAndWrongPasswordDoNotGrantAccess() throws Exception {
        mvc.perform(post("/api/government/login").param("username","coursework-admin").param("password",PASSWORD)).andExpect(status().isForbidden());
        mvc.perform(post("/api/government/login").with(csrf()).param("username","coursework-admin").param("password","incorrect-test-input")).andExpect(status().isUnauthorized());
    }
    @Test void failedLoginAttemptsAreBoundedAndDoNotAuthenticate() throws Exception {
        for(int n=0;n<5;n++) mvc.perform(post("/api/government/login").with(csrf()).with(r->{r.setRemoteAddr("198.51.100.9");return r;}).param("username","coursework-admin").param("password","incorrect-test-input")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/government/login").with(csrf()).with(r->{r.setRemoteAddr("198.51.100.9");return r;}).param("username","coursework-admin").param("password",PASSWORD)).andExpect(status().isTooManyRequests());
    }
    @Test @WithMockUser(roles="GOVERNMENT_DEMO") void expiredDraftCannotBePublishedAndInvalidFiltersFail() throws Exception {
        var e=(com.fasterxml.jackson.databind.node.ObjectNode)json.readTree(body("Expired demonstration"));
        e.put("validFrom",Instant.now().minusSeconds(7200).toString());e.put("validUntil",Instant.now().minusSeconds(3600).toString());
        var r=mvc.perform(post("/api/government/announcements").with(csrf()).contentType("application/json").content(e.toString())).andExpect(status().isOk()).andReturn();
        String id=json.readTree(r.getResponse().getContentAsString()).path("id").asText();
        mvc.perform(post("/api/government/announcements/"+id+"/state").with(csrf()).contentType("application/json").content("{\"status\":\"PUBLISHED\",\"revision\":1}")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/announcements").param("region","OUTSIDE_CATALOG")).andExpect(status().isBadRequest());
    }
    @Test void basicAuthorizationIsNotAGovernmentSession() throws Exception {
        mvc.perform(get("/api/government/analytics").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic("coursework-admin",PASSWORD))).andExpect(status().isUnauthorized());
    }
    @Test void oversizedLoginInputsAreRejectedBeforePasswordVerification() throws Exception {
        mvc.perform(post("/api/government/login").with(csrf()).param("username","coursework-admin").param("password","x".repeat(73))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/government/login").with(csrf()).param("username","x".repeat(65)).param("password",PASSWORD)).andExpect(status().isBadRequest());
    }
}
