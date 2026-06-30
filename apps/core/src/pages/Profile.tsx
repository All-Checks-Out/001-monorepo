import { useCurrentUser } from "../context/CurrentUserContext";
import Page from "../components/Page";

const Profile = () => {
  const { user } = useCurrentUser();

  return (
    <Page title="Profile">
      <p className="text-sm">{user?.email ?? ""}</p>
    </Page>
  );
};

export default Profile;
