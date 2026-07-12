import type { OAuth2Config } from "@auth/core/providers";

export interface Doctor8Profile {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  role?: string;
  verified?: boolean;
}

export function doctor8Provider(): OAuth2Config<Doctor8Profile> {
  const issuer =
    process.env.AUTH_DOCTOR8_ISSUER?.replace(/\/$/, "") ??
    "https://app.doctor8.org";

  return {
    id: "doctor8",
    name: "Doctor8",
    type: "oauth",
    issuer,
    clientId: process.env.AUTH_DOCTOR8_ID,
    clientSecret: process.env.AUTH_DOCTOR8_SECRET,
    checks: ["pkce", "state"],
    client: {
      token_endpoint_auth_method: "client_secret_post",
    },
    authorization: {
      url: `${issuer}/api/oauth/authorize`,
      params: { scope: "openid email profile", prompt: "login" },
    },
    token: `${issuer}/api/oauth/token`,
    userinfo: `${issuer}/api/oauth/userinfo`,
    profile(profile) {
      return {
        id: profile.sub,
        name: profile.name ?? "",
        email: profile.email ?? "",
        image: profile.picture,
      };
    },
  };
}
