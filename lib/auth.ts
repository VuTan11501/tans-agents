import type { AuthOptions } from "next-auth"
import GitHubProvider from "next-auth/providers/github"

export const authOptions: AuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, profile }) {
      if (profile && (profile as any).id) {
        token.ghId = String((profile as any).id)
        token.ghLogin = (profile as any).login
      }
      return token
    },
    async session({ session, token }) {
      if (token.ghId) (session as any).ghId = token.ghId
      if (token.ghLogin) (session as any).ghLogin = token.ghLogin
      return session
    },
  },
}
