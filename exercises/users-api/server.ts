import bodyParser from 'body-parser';
import express from 'express';
import getPort from 'get-port';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

export const app = express();
const port = await getPort({ port: 3000 });

app.use(bodyParser.json());

const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'please provide a name'),
  email: z.string().email().min(1, 'please provide a valid email'),
});

const CreateUserSchema = UserSchema.omit({ id: true });
const PartialUserSchema = UserSchema.partial();

type User = z.infer<typeof UserSchema>;

const users: User[] = [];

// Create a new user
app.post('/users', (req, res) => {
  const result = CreateUserSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ message: 'Name and email are required' });
  }

  const { email, name } = result.data;

  const newUser: User = { id: uuidv4(), name, email };

  users.push(newUser);

  res.status(201).json(newUser);
});

// Read all users
app.get('/users', (req, res) => {
  const { name, email } = PartialUserSchema.parse(req.query);

  let filteredUsers = users;

  if (name) {
    filteredUsers = filteredUsers.filter((user) =>
      user.name.toLowerCase().includes(name.toLowerCase()),
    );
  }

  if (email) {
    filteredUsers = filteredUsers.filter((user) =>
      user.email.toLowerCase().includes(email.toLowerCase()),
    );
  }

  res.json(filteredUsers);
});

// Read a single user by ID
app.get('/users/:id', (req, res) => {
  const result = UserSchema.pick({ id: true }).safeParse(req.params);

  if (!result.success) {
    return res.status(400).json({ message: 'Please provide a valid id' });
  }

  const user = users.find((u) => u.id === result.data.id);

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.json(user);
});

// Update a user by ID
app.put('/users/:id', (req, res) => {
  const { id } = req.params;

  const user = users.find((u) => u.id === id);

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const { name, email } = PartialUserSchema.parse(req.body);

  if (name) user.name = name;
  if (email) user.email = email;

  res.json(user);
});

// Delete a user by ID
app.delete('/users/:id', (req, res) => {
  const id = req.params.id;

  const index = users.findIndex((u) => u.id === id);

  if (index === -1) {
    return res.status(404).json({ message: 'User not found' });
  }

  users.splice(index, 1);

  res.status(204).send();
});

const isMain = process.argv[1] === fileURLToPath(import.meta.url);

if (isMain) {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}
