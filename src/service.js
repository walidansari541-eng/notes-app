const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { notesModel, authModel } = require("./db.js");
const { publishFakeSms } = require("./publisher");

const notesService = {
  async getNotesById(req, res) {
    const noteId = req.params.id;
    console.log("Fetching note with ID:", noteId);

    const userId = req.user.userId; // Get the userId from the authenticated user
    try {
      const note = await notesModel.getById(noteId, userId);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      res.status(200).json(note);
    } catch (error) {
      console.error("Error fetching note by ID:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
  async getNotes(req, res) {
    const userId = req.user.userId; // Get the userId from the authenticated user
    try {
      const notes = await notesModel.getNotes(userId);
      res.status(200).json(notes);
    } catch (error) {
      console.error("Error fetching notes:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
  async createNotes(req, res) {
    const { title, description } = req.body;
    const userId = req.user.userId;

    try {
      const note = await notesModel.createNotes(title, description, userId);
      res.status(201).json(note);
    } catch (error) {
      console.error("Error creating note:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
    async updateNotes(req, res) {
    const noteId = req.params.id;
    const { title, description } = req.body;
    const userId = req.user.userId;

    try {
      const note = await notesModel.updateNotes(noteId, title, description, userId);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      res.status(200).json(note);
    } catch (error) {
      console.error("Error updating note:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
    async deleteNotes(req, res) {
    const noteId = req.params.id;
    const userId = req.user.userId;

    try {
      const deletedNote = await notesModel.deleteNotes(noteId, userId);
      if (!deletedNote) {
        return res.status(404).json({ error: "Note not found" });
      }
      res.status(200).json({ message: "Note deleted successfully" });
    } catch (error) {
      console.error("Error deleting note:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
  async healthCheck(req, res) {
    try {
      const dbStatus = await notesModel.checkDatabaseConnection();
      return res.status(200).json({
        status: "UP",
        timestamp: new Date(),
        services: { database: "HEALTHY" },
      });
    } catch (error) {
      res.status(503).json({
        status: "DOWN",
        timestamp: new Date(),
        error: error.message,
      });
    }
  },
};

const authService = {
  login: async (req, res) => {
    const { username, password } = req.body;
    try {
      if (!username || !password) {
        return res
          .status(400)
          .json({ error: "Username and password are required" });
      }
      const user = await authModel.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "User Not Found" });
      }
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Invalid Username or Password" });
      }

      const sessionToken = crypto.randomBytes(16).toString("hex");
      await authModel.setToken(sessionToken, {userId: user.id, username: user.username});

      res
        .status(200)
        .json({ message: "Login successful", token: sessionToken });
    } catch (error) {
      console.error("Error logging in:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
  register: async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = await authModel.registerUser(username, hashedPassword);

    try {
      const { published, correlationId } = publishFakeSms({
        userId: user.id,
        phone: "+10000000000",
        message: `Welcome ${user.username}! Your account has been created.`,
      });

      // published === false means the channel's write buffer is full. The
      // message is still queued in memory locally, not lost, but it is a signal
      // to stop publishing. Logging it is the minimum; ignoring it silently is
      // how a publisher ends up holding thousands of messages in RAM.
      if (!published) {
        console.warn(`Broker backpressure while publishing ${correlationId}`);
      }
    } catch (error) {
      console.error("Failed to publish welcome SMS event:", error);
    }

    res.status(201).json(user);
  },
}

module.exports = { notesService, authService };
