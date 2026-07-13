const express = require('express');
const router = express.Router();

const { notesService, authService } = require('./service');
const { authModel } = require('./db');


router.get('/health', authModel.authGuard, notesService.healthCheck);
router.get('/notes/:id', authModel.authGuard, notesService.getNotesById);
router.get('/notes', authModel.authGuard, notesService.getNotes);
router.post('/notes', authModel.authGuard, notesService.createNotes);
router.put('/notes/:id', authModel.authGuard, notesService.updateNotes);
router.delete('/notes/:id', authModel.authGuard, notesService.deleteNotes);

router.post('/register', authService.register);
router.post('/login', authService.login);





module.exports = router;

