1. Add word and token count for global system prompt

2. enhance symposium regeneration

3. Users can add tags to cards, and the user can add tags to the context of teh global system prompt, which adds all cards with the tag. 

4. Create list of core consultants, these are not added, they are initally available to use

5. investigate html  and media in markdown (maybe css too?)

6. extend teh abilties of teh knowlede base card to be more like hepta base cards

7. Make gemini 2.5 pro the default for all llm calls (unless specific model is needed)

8. fix task sequence rearangement bug

9. llm guided strucutured api calls for consultants. All api calls have a strucutred input form that is used for teh api call. The user can manually input the form, or get teh llm consultant to fill in teh form, using its context from the global system prompt. This allows api calls to be controlled, comsice, but also more effiecient. And the llm recieves teh data and formats in a way that is presentable for the user.