import NextAuth from 'next-auth';

export const { auth } = NextAuth({
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role!;
        token.userId = user.userId!;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.userId = token.userId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
});
