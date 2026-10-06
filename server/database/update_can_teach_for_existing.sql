-- Update can_teach column for existing user_modules based on grade
UPDATE user_modules 
SET can_teach = CASE 
  WHEN grade IN ('A', '2.1', '2.2') THEN true
  ELSE false
END
WHERE can_teach IS NULL OR can_teach = false;
