const express = require('express');
const { ApolloServer, gql } = require('apollo-server-express');
const { Pool } = require('pg');
const Redis = require('ioredis');

const app = express();
const port = process.env.PORT || 4000;

const pool = new Pool({
    user: 'hganmrhu',
    host: 'lallah.db.elephantsql.com',
    database: 'hganmrhu',
    password: 'zeoEzYgoQCp21rN8QX-2hViCsRCycNeZ',
    port: 5432,
});

const redis = new Redis({
    port: 17923, // Redis port
    host: "redis-17923.c326.us-east-1-3.ec2.cloud.redislabs.com", // Redis host
    username: "default", // needs Redis >= 6
    password: "eVX2SMnPpMe1c58xuAfCWyNCLwZqXyRK",
    db: 0, // Defaults to 0
}); // Connect to your Redis instance

const typeDefs = gql`
    type Blog {
        id: ID!
        title: String!
        content: String!
    }

    type Query {
        blogs: [Blog]
        blog(id: ID!): Blog
    }

    type Mutation {
        createBlog(title: String!, content: String!): Blog
    }
`;

const resolvers = {
    Query: {
        blogs: async () => {
            console.log('Called')
            const cachedBlogs = await redis.get('blogs');
            if (cachedBlogs) {
                return JSON.parse(cachedBlogs);
            }

            const result = await pool.query('SELECT * FROM blogs');
            const blogs = result.rows;

            // Cache the result for 1 minute (adjust the TTL as needed)
            await redis.set('blogs', JSON.stringify(blogs), 'EX', 60);

            return blogs;
        },
        blog: async (_, { id }) => {
            const cachedBlog = await redis.get(`blog:${id}`);
            if (cachedBlog) {
                return JSON.parse(cachedBlog);
            }

            const result = await pool.query('SELECT * FROM blogs WHERE id = $1', [id]);
            const blog = result.rows[0];

            // Cache the result for 1 minute (adjust the TTL as needed)
            await redis.set(`blog:${id}`, JSON.stringify(blog), 'EX', 60);

            return blog;
        },
    },
    Mutation: {
        createBlog: async (_, { title, content }) => {
            const result = await pool.query('INSERT INTO blogs (title, content) VALUES ($1, $2) RETURNING *', [title, content]);
            const newBlog = result.rows[0];

            // Clear the cached blogs to ensure the latest data is fetched
            await redis.del('blogs');

            return newBlog;
        },
    },
};

async function startServer() {
  let apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: true,
    playground: true,
  });
  await apolloServer.start();
  apolloServer.applyMiddleware({ app });
}
startServer();

app.listen({ port }, () =>
    console.log(`Server ready:: `)
);
